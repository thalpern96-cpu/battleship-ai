/* Battleship UI: wires the engine, themes, AI personas, sound and effects to the page. */
(function () {
  'use strict';

  const B = window.Battleship;
  const Themes = window.BattleshipThemes;
  const Personas = window.BattleshipPersonas;
  const Sound = window.BattleshipSound;

  const ROWS = 'ABCDEFGHIJ';
  const AI_DELAY_MS = 750;
  const STATS_KEY = 'battleship-ai-stats';
  const THEME_KEY = 'battleship-ai-theme';
  const MISS_CHATTER = 0.35;

  const $ = (id) => document.getElementById(id);
  const els = {
    title: $('game-title'),
    subtitle: $('game-subtitle'),
    difficulty: $('difficulty'),
    theme: $('theme'),
    muteBtn: $('mute-btn'),
    stats: $('stats'),
    placementControls: $('placement-controls'),
    battleControls: $('battle-controls'),
    rotateBtn: $('rotate-btn'),
    orientationLabel: $('orientation-label'),
    randomBtn: $('random-btn'),
    clearBtn: $('clear-btn'),
    startBtn: $('start-btn'),
    restartBtn: $('restart-btn'),
    moveBtn: $('move-btn'),
    moveRotateBtn: $('move-rotate-btn'),
    cancelMoveBtn: $('cancel-move-btn'),
    status: $('status'),
    personaAvatar: $('persona-avatar'),
    personaName: $('persona-name'),
    personaMood: $('persona-mood'),
    personaBubble: $('persona-bubble'),
    boards: $('boards'),
    playerBoardTitle: $('player-board-title'),
    enemyBoardTitle: $('enemy-board-title'),
    playerBoard: $('player-board'),
    enemyBoard: $('enemy-board'),
    playerShips: $('player-ships'),
    enemyShips: $('enemy-ships'),
    log: $('log'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayText: $('overlay-text'),
    overlayQuote: $('overlay-quote'),
    endStats: $('end-stats'),
    endStatsAi: $('end-stats-ai'),
    sinkTimeline: $('sink-timeline'),
    heatAiBtn: $('heat-ai-btn'),
    heatPlayerBtn: $('heat-player-btn'),
    heatmap: $('heatmap'),
    playAgainBtn: $('play-again-btn'),
    closeOverlayBtn: $('close-overlay-btn'),
  };

  let state = null;
  let theme = Themes.get(null);
  let aiTimer = null;
  let hoverCell = null;

  const coord = (r, c) => ROWS[r] + (c + 1);
  const shipName = (id) => theme.ships[id];

  // ---------- persisted settings ----------
  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY));
      if (s && Number.isFinite(s.wins) && Number.isFinite(s.losses)) return s;
    } catch (e) { /* storage unavailable or corrupt */ }
    return { wins: 0, losses: 0 };
  }

  function saveStats(s) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function renderStats() {
    const s = loadStats();
    els.stats.textContent = `Wins: ${s.wins} · Losses: ${s.losses}`;
  }

  function loadThemeId() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function applyTheme(id) {
    theme = Themes.get(id);
    try { localStorage.setItem(THEME_KEY, theme.id); } catch (e) { /* ignore */ }
    document.body.dataset.theme = theme.id;
    els.theme.value = theme.id;
    els.title.textContent = theme.title;
    els.subtitle.textContent = theme.subtitle;
    els.playerBoardTitle.textContent = theme.playerBoard;
    els.enemyBoardTitle.textContent = theme.enemyBoard;
    if (state) render();
  }

  function renderMute() {
    const muted = Sound.isMuted();
    els.muteBtn.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    els.muteBtn.setAttribute('aria-pressed', String(muted));
  }

  // ---------- board DOM ----------
  function buildGrid(container) {
    container.innerHTML = '';
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.row = r;
        btn.dataset.col = c;
        container.appendChild(btn);
      }
    }
  }

  function cellEl(container, r, c) {
    return container.querySelectorAll('.cell')[r * B.SIZE + c];
  }

  // ---------- effects ----------
  function fx(container, r, c, type, delayMs) {
    const cell = cellEl(container, r, c);
    const span = document.createElement('span');
    span.className = `fx fx-${type}`;
    span.style.left = `${cell.offsetLeft}px`;
    span.style.top = `${cell.offsetTop}px`;
    span.style.width = `${cell.offsetWidth}px`;
    span.style.height = `${cell.offsetHeight}px`;
    if (delayMs) span.style.animationDelay = `${delayMs}ms`;
    container.appendChild(span);
    const remove = () => span.remove();
    span.addEventListener('animationend', (e) => { if (e.target === span) remove(); });
    setTimeout(remove, 2000 + (delayMs || 0));
  }

  function shake(strong) {
    const cls = strong ? 'shake-strong' : 'shake';
    els.boards.classList.remove('shake', 'shake-strong');
    void els.boards.offsetWidth; // restart the animation
    els.boards.classList.add(cls);
  }

  function shotEffects(container, r, c, outcome) {
    if (outcome.result === 'miss') {
      fx(container, r, c, 'splash');
      Sound.play('miss');
    } else if (outcome.result === 'hit') {
      fx(container, r, c, 'boom');
      shake(false);
      Sound.play('hit');
    } else if (outcome.result === 'sunk') {
      fx(container, r, c, 'boom');
      outcome.ship.cells.forEach(([sr, sc], i) => fx(container, sr, sc, 'sink', 150 + i * 90));
      shake(true);
      Sound.play('sunk');
    }
  }

  // ---------- AI persona ----------
  function renderPersona() {
    const p = state.persona;
    els.personaAvatar.textContent = '';
    if (p.photo) {
      const img = document.createElement('img');
      img.src = p.photo;
      img.alt = '';
      img.onerror = () => { els.personaAvatar.textContent = p.initials; };
      els.personaAvatar.appendChild(img);
    } else {
      els.personaAvatar.textContent = p.initials;
    }
    els.personaName.textContent = p.name;
    els.personaMood.textContent = `(${p.mood})`;
    els.endStatsAi.textContent = p.name;
  }

  function say(event, vars, toLog) {
    const text = Personas.line(state.persona, event, vars, state.lastLine);
    if (!text) return;
    state.lastLine = text;
    els.personaBubble.textContent = text;
    els.personaBubble.classList.remove('pop');
    void els.personaBubble.offsetWidth;
    els.personaBubble.classList.add('pop');
    if (toLog) addLog('persona', `${state.persona.name}: “${text}”`);
  }

  // ---------- game lifecycle ----------
  function newGame() {
    clearTimeout(aiTimer);
    aiTimer = null;
    hoverCell = null;
    state = {
      phase: 'placement',
      player: B.createBoard(),
      enemy: B.randomFleet(),
      ai: new B.AI(els.difficulty.value),
      persona: Personas.forDifficulty(els.difficulty.value),
      horizontal: true,
      selectedShip: B.FLEET[0].id,
      aiThinking: false,
      turn: 0,
      playerShots: [],
      aiShots: [],
      sinks: [],
      lastPlayerShot: null,
      lastAiShot: null,
      moveUsed: false,
      moving: null, // null | 'select' | shipId
      lastLine: null,
    };
    els.log.innerHTML = '';
    hideOverlay();
    renderPersona();
    say('start');
    setStatus('Place your ships. Pick a ship below your board, then click a square.');
    render();
  }

  function startBattle() {
    if (state.phase !== 'placement' || state.player.ships.length !== B.FLEET.length) return;
    state.phase = 'battle';
    state.selectedShip = null;
    state.ai = new B.AI(els.difficulty.value);
    clearPreview();
    addLog('system', `Battle started against ${state.persona.name} (${els.difficulty.value}). You fire first.`);
    say('start');
    setStatus('Your turn — fire at the enemy board.');
    render();
  }

  function endGame(playerWon) {
    state.phase = 'over';
    state.aiThinking = false;
    state.moving = null;
    const s = loadStats();
    if (playerWon) s.wins++; else s.losses++;
    saveStats(s);
    renderStats();
    say(playerWon ? 'aiLose' : 'aiWin', null, true);
    Sound.play(playerWon ? 'win' : 'lose');
    if (playerWon) setStatus('Victory! You sank the entire enemy fleet.');
    else setStatus('Defeat. The AI sank your fleet.');
    render();
    showEndScreen(playerWon);
  }

  // ---------- placement ----------
  function nextUnplacedShip() {
    const def = B.FLEET.find((d) => !B.getShip(state.player, d.id));
    return def ? def.id : null;
  }

  function selectedDef() {
    return B.FLEET.find((d) => d.id === state.selectedShip) || null;
  }

  function onPlayerCellClick(r, c) {
    if (state.phase === 'battle' && state.moving) {
      onMoveClick(r, c);
      return;
    }
    if (state.phase !== 'placement') return;
    const existing = state.player.cells[r][c].shipId;
    if (existing) {
      const ship = B.removeShip(state.player, existing);
      state.selectedShip = ship.id;
      state.horizontal = ship.horizontal;
      setStatus(`Picked up your ${shipName(ship.id)}. Click to place it again.`);
    } else {
      const def = selectedDef();
      if (!def) return;
      if (B.placeShip(state.player, def, r, c, state.horizontal)) {
        state.selectedShip = nextUnplacedShip();
        setStatus(state.selectedShip
          ? 'Ship placed. Place the next one.'
          : 'All ships placed! Press "Start battle". (Click a ship to move it.)');
      } else {
        setStatus(`The ${shipName(def.id)} doesn't fit there.`);
      }
    }
    render();
    showPreview(r, c);
  }

  function canRotate() {
    return state.phase === 'placement' || (state.phase === 'battle' && state.moving && state.moving !== 'select');
  }

  function toggleOrientation() {
    if (!canRotate()) return;
    state.horizontal = !state.horizontal;
    renderControls();
    if (hoverCell) showPreview(hoverCell[0], hoverCell[1]);
  }

  function clearPreview() {
    for (const el of els.playerBoard.querySelectorAll('.preview-valid, .preview-invalid')) {
      el.classList.remove('preview-valid', 'preview-invalid');
    }
  }

  function paintPreview(r, c, size, valid) {
    for (const [pr, pc] of B.shipCells(r, c, size, state.horizontal)) {
      if (!B.inBounds(pr, pc)) continue;
      cellEl(els.playerBoard, pr, pc).classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  }

  function showPreview(r, c) {
    clearPreview();
    if (state.phase === 'placement') {
      const def = selectedDef();
      if (!def || state.player.cells[r][c].shipId) return;
      paintPreview(r, c, def.size, B.canPlace(state.player, r, c, def.size, state.horizontal));
    } else if (state.phase === 'battle' && state.moving && state.moving !== 'select') {
      const ship = B.getShip(state.player, state.moving);
      paintPreview(r, c, ship.size, B.canMoveShip(state.player, ship.id, r, c, state.horizontal));
    }
  }

  function randomPlacement() {
    if (state.phase !== 'placement') return;
    state.player = B.randomFleet();
    state.selectedShip = null;
    setStatus('Ships placed randomly. Press "Start battle", or click a ship to move it.');
    render();
  }

  function clearPlacement() {
    if (state.phase !== 'placement') return;
    state.player = B.createBoard();
    state.selectedShip = B.FLEET[0].id;
    setStatus('Board cleared. Place your ships.');
    render();
  }

  // ---------- movable fleet (once per game) ----------
  function undamagedShips() {
    return state.player.ships.filter((s) => s.hits === 0);
  }

  function beginMove() {
    if (state.phase !== 'battle' || state.aiThinking || state.moveUsed || state.moving) return;
    if (undamagedShips().length === 0) {
      setStatus('All your ships are damaged — none can be moved.');
      return;
    }
    state.moving = 'select';
    setStatus('Move a ship: click one of your undamaged ships (outlined). Esc to cancel.');
    render();
  }

  function cancelMove() {
    if (!state.moving) return;
    state.moving = null;
    clearPreview();
    setStatus('Move cancelled. Your turn — fire at the enemy board.');
    render();
  }

  function onMoveClick(r, c) {
    if (state.aiThinking) return;
    const shipId = state.player.cells[r][c].shipId;
    if (state.moving === 'select') {
      const ship = shipId && B.getShip(state.player, shipId);
      if (!ship) { setStatus('Click one of your undamaged ships to pick it up.'); return; }
      if (ship.hits > 0) { setStatus(`Your ${shipName(ship.id)} is damaged and can't move. Pick an undamaged ship.`); return; }
      state.moving = ship.id;
      state.horizontal = ship.horizontal;
      setStatus(`Click where your ${shipName(ship.id)} should go (R to rotate). It can't cover squares already fired at.`);
      render();
      showPreview(r, c);
      return;
    }
    const ship = B.getShip(state.player, state.moving);
    if (!B.moveShip(state.player, ship.id, r, c, state.horizontal)) {
      setStatus(`Your ${shipName(ship.id)} can't go there. It must stay on the board, avoid other ships and avoid squares already fired at.`);
      return;
    }
    state.moving = null;
    state.moveUsed = true;
    state.turn++;
    clearPreview();
    Sound.play('move');
    addLog('player', `Turn ${state.turn}: you secretly moved your ${shipName(ship.id)}.`);
    say('playerMoved', null, true);
    queueAiTurn();
  }

  // ---------- battle ----------
  function onEnemyCellClick(r, c) {
    if (state.phase !== 'battle' || state.aiThinking || state.moving) return;
    const outcome = B.receiveShot(state.enemy, r, c);
    if (outcome.result === 'repeat' || outcome.result === 'invalid') return;

    state.turn++;
    state.playerShots.push({ r, c, result: outcome.result, turn: state.turn });
    state.lastPlayerShot = [r, c];
    const at = `Turn ${state.turn}: you fired at ${coord(r, c)}`;
    if (outcome.result === 'miss') {
      addLog('player', `${at}: miss.`);
      if (Math.random() < MISS_CHATTER) say('playerMiss');
    } else if (outcome.result === 'sunk') {
      const name = shipName(outcome.ship.id);
      state.sinks.push({ turn: state.turn, by: 'player', shipId: outcome.ship.id });
      addLog('player', `${at}: you sank their ${name}!`);
      say('playerSunk', { ship: name }, true);
    } else {
      addLog('player', `${at}: hit!`);
      say('playerHit');
    }

    render();
    shotEffects(els.enemyBoard, r, c, outcome);

    if (B.allSunk(state.enemy)) {
      endGame(true);
      return;
    }
    queueAiTurn();
  }

  function queueAiTurn() {
    state.aiThinking = true;
    setStatus(`${state.persona.name} is aiming…`);
    render();
    aiTimer = setTimeout(aiTurn, AI_DELAY_MS);
  }

  function aiTurn() {
    aiTimer = null;
    if (!state || state.phase !== 'battle') return;
    const [r, c] = state.ai.nextShot();
    const outcome = B.receiveShot(state.player, r, c);
    state.ai.record(r, c, outcome);
    state.aiShots.push({ r, c, result: outcome.result, turn: state.turn });
    state.lastAiShot = [r, c];

    const at = `Turn ${state.turn}: enemy fired at ${coord(r, c)}`;
    if (outcome.result === 'miss') {
      addLog('ai', `${at}: miss.`);
      if (Math.random() < MISS_CHATTER) say('aiMiss');
    } else if (outcome.result === 'sunk') {
      const name = shipName(outcome.ship.id);
      state.sinks.push({ turn: state.turn, by: 'ai', shipId: outcome.ship.id });
      addLog('ai', `${at}: they sank your ${name}!`);
      say('aiSunk', { ship: name }, true);
    } else {
      addLog('ai', `${at}: hit!`);
      say('aiHit');
    }

    state.aiThinking = false;
    render();
    shotEffects(els.playerBoard, r, c, outcome);

    if (B.allSunk(state.player)) {
      endGame(false);
      return;
    }
    setStatus('Your turn — fire at the enemy board.');
  }

  // ---------- end-of-game stats ----------
  function shotStats(shots) {
    let hits = 0, streak = 0, best = 0;
    for (const s of shots) {
      if (s.result === 'miss') { streak = 0; continue; }
      hits++;
      streak++;
      best = Math.max(best, streak);
    }
    const accuracy = shots.length ? Math.round((hits / shots.length) * 100) : 0;
    return { shots: shots.length, hits, accuracy, streak: best };
  }

  function showEndScreen(playerWon) {
    const you = shotStats(state.playerShots);
    const ai = shotStats(state.aiShots);
    els.overlayTitle.textContent = playerWon ? 'You win! 🎉' : 'You lose';
    els.overlayText.textContent = playerWon
      ? `You sank the enemy fleet in ${state.turn} turns.`
      : `${state.persona.name} sank your fleet in ${state.turn} turns. The enemy's remaining ships are now revealed.`;
    els.overlayQuote.textContent = `${state.persona.name}: “${state.lastLine}”`;

    const rows = [
      ['Shots fired', you.shots, ai.shots],
      ['Hits', you.hits, ai.hits],
      ['Accuracy', `${you.accuracy}%`, `${ai.accuracy}%`],
      ['Longest hit streak', you.streak, ai.streak],
      ['Ships sunk', state.sinks.filter((s) => s.by === 'player').length, state.sinks.filter((s) => s.by === 'ai').length],
    ];
    const tbody = els.endStats.querySelector('tbody');
    tbody.innerHTML = '';
    for (const [label, a, b] of rows) {
      const tr = document.createElement('tr');
      for (const v of [label, a, b]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    els.sinkTimeline.innerHTML = '';
    for (const s of state.sinks) {
      const li = document.createElement('li');
      li.className = s.by === 'player' ? 'by-player' : 'by-ai';
      li.textContent = s.by === 'player'
        ? `Turn ${s.turn}: you sank the enemy ${shipName(s.shipId)}`
        : `Turn ${s.turn}: ${state.persona.name} sank your ${shipName(s.shipId)}`;
      els.sinkTimeline.appendChild(li);
    }
    if (state.sinks.length === 0) els.sinkTimeline.innerHTML = '<li>No ships were sunk.</li>';

    showHeatmap('ai');
    els.overlay.classList.remove('hidden');
    els.overlay.firstElementChild.scrollTop = 0;
    els.playAgainBtn.focus({ preventScroll: true });
  }

  function showHeatmap(which) {
    const shots = which === 'ai' ? state.aiShots : state.playerShots;
    const board = which === 'ai' ? state.player : state.enemy;
    els.heatAiBtn.classList.toggle('active', which === 'ai');
    els.heatPlayerBtn.classList.toggle('active', which !== 'ai');
    els.heatAiBtn.setAttribute('aria-selected', String(which === 'ai'));
    els.heatPlayerBtn.setAttribute('aria-selected', String(which !== 'ai'));

    const order = new Map();
    shots.forEach((s, i) => order.set(s.r * B.SIZE + s.c, { i, result: s.result }));
    els.heatmap.innerHTML = '';
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const div = document.createElement('div');
        div.className = 'heat-cell';
        const shot = order.get(r * B.SIZE + c);
        if (board.cells[r][c].shipId) div.classList.add('ship-outline');
        if (shot) {
          const t = shots.length > 1 ? shot.i / (shots.length - 1) : 0;
          div.style.background = `hsl(${55 - 55 * t}, ${95 - 10 * t}%, ${65 - 20 * t}%)`;
          div.textContent = shot.result === 'miss' ? '•' : '✕';
          div.classList.add('shot');
          div.title = `${coord(r, c)}: shot #${shot.i + 1} (${shot.result})`;
        }
        els.heatmap.appendChild(div);
      }
    }
  }

  // ---------- rendering ----------
  function setStatus(text) {
    els.status.textContent = text;
  }

  function addLog(who, text) {
    const li = document.createElement('li');
    li.className = who;
    li.textContent = text;
    els.log.prepend(li);
  }

  function hideOverlay() {
    els.overlay.classList.add('hidden');
  }

  function renderControls() {
    const placing = state.phase === 'placement';
    const battle = state.phase === 'battle';
    els.placementControls.classList.toggle('hidden', !placing);
    els.battleControls.classList.toggle('hidden', placing);
    els.orientationLabel.textContent = state.horizontal ? 'Horizontal' : 'Vertical';
    els.startBtn.disabled = state.player.ships.length !== B.FLEET.length;
    els.difficulty.disabled = battle;

    els.moveBtn.classList.toggle('hidden', !!state.moving);
    els.moveBtn.disabled = !battle || state.aiThinking || state.moveUsed || undamagedShips().length === 0;
    els.moveBtn.textContent = state.moveUsed ? '🚢 Move used' : '🚢 Move a ship (1 left)';
    els.cancelMoveBtn.classList.toggle('hidden', !state.moving);
    els.moveRotateBtn.classList.toggle('hidden', !state.moving || state.moving === 'select');
    els.moveRotateBtn.textContent = `Rotate (R): ${state.horizontal ? 'Horizontal' : 'Vertical'}`;
  }

  function sameCell(a, r, c) {
    return a && a[0] === r && a[1] === c;
  }

  function renderPlayerBoard() {
    const board = state.player;
    const moving = state.phase === 'battle' && !!state.moving;
    els.playerBoard.classList.toggle('placing', state.phase === 'placement');
    els.playerBoard.classList.toggle('moving', moving);
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const cell = board.cells[r][c];
        const el = cellEl(els.playerBoard, r, c);
        const ship = cell.shipId ? B.getShip(board, cell.shipId) : null;
        const sunk = ship && B.isSunk(ship);
        el.className = 'cell';
        if (ship) el.classList.add('ship');
        if (cell.shot) el.classList.add(ship ? (sunk ? 'sunk' : 'hit') : 'miss');
        if (sunk) el.classList.add('hit');
        if (moving && ship && state.moving === ship.id) el.classList.add('lifted');
        if (moving && state.moving === 'select' && ship && ship.hits === 0) el.classList.add('movable');
        if (sameCell(state.lastAiShot, r, c)) el.classList.add('last-shot');
        const name = ship ? shipName(ship.id) : '';
        let label = `Your ${coord(r, c)}: `;
        label += ship ? (cell.shot ? (sunk ? `${name}, sunk` : `${name}, hit`) : name) : (cell.shot ? 'miss' : 'water');
        el.setAttribute('aria-label', label);
        el.disabled = !(state.phase === 'placement' || (moving && !state.aiThinking));
      }
    }
  }

  function renderEnemyBoard() {
    const board = state.enemy;
    const canFire = state.phase === 'battle' && !state.aiThinking && !state.moving;
    els.enemyBoard.classList.toggle('targetable', canFire);
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const cell = board.cells[r][c];
        const el = cellEl(els.enemyBoard, r, c);
        const ship = cell.shipId ? B.getShip(board, cell.shipId) : null;
        const sunk = ship && B.isSunk(ship);
        el.className = 'cell';
        let label = `Enemy ${coord(r, c)}: `;
        if (!cell.shot) {
          if (state.phase === 'over' && ship) { el.classList.add('revealed'); label += `${shipName(ship.id)} (revealed)`; }
          else { el.classList.add('unknown'); label += 'not fired at'; }
        } else if (!ship) {
          el.classList.add('miss'); label += 'miss';
        } else if (sunk) {
          el.classList.add('sunk', 'hit'); label += `${shipName(ship.id)}, sunk`;
        } else {
          el.classList.add('hit'); label += 'hit';
        }
        if (sameCell(state.lastPlayerShot, r, c)) el.classList.add('last-shot');
        el.setAttribute('aria-label', label);
        el.disabled = state.phase !== 'battle' || cell.shot;
      }
    }
  }

  function renderShipLists() {
    els.playerShips.innerHTML = '';
    for (const def of B.FLEET) {
      const li = document.createElement('li');
      const ship = B.getShip(state.player, def.id);
      li.textContent = `${shipName(def.id)} (${def.size})`;
      li.dataset.ship = def.id;
      if (state.phase === 'placement') {
        if (ship) li.classList.add('placed');
        else li.classList.add('selectable');
        if (state.selectedShip === def.id) li.classList.add('selected');
      } else if (ship && B.isSunk(ship)) {
        li.classList.add('sunk');
      }
      els.playerShips.appendChild(li);
    }

    els.enemyShips.innerHTML = '';
    for (const def of B.FLEET) {
      const li = document.createElement('li');
      const ship = B.getShip(state.enemy, def.id);
      li.textContent = `${shipName(def.id)} (${def.size})`;
      if (ship && B.isSunk(ship)) li.classList.add('sunk');
      els.enemyShips.appendChild(li);
    }
  }

  function render() {
    renderControls();
    renderPlayerBoard();
    renderEnemyBoard();
    renderShipLists();
  }

  // ---------- events ----------
  function cellFromEvent(e) {
    const el = e.target.closest('.cell');
    if (!el) return null;
    return [Number(el.dataset.row), Number(el.dataset.col)];
  }

  function bindEvents() {
    els.playerBoard.addEventListener('click', (e) => {
      const rc = cellFromEvent(e);
      if (rc) onPlayerCellClick(rc[0], rc[1]);
    });
    els.playerBoard.addEventListener('mouseover', (e) => {
      const rc = cellFromEvent(e);
      if (!rc) return;
      hoverCell = rc;
      showPreview(rc[0], rc[1]);
    });
    els.playerBoard.addEventListener('mouseleave', () => {
      hoverCell = null;
      clearPreview();
    });
    els.enemyBoard.addEventListener('click', (e) => {
      const rc = cellFromEvent(e);
      if (rc) onEnemyCellClick(rc[0], rc[1]);
    });
    els.playerShips.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li || state.phase !== 'placement' || B.getShip(state.player, li.dataset.ship)) return;
      state.selectedShip = li.dataset.ship;
      renderShipLists();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
        toggleOrientation();
      } else if (e.key === 'Escape') {
        if (state.moving) cancelMove();
        else hideOverlay();
      }
    });
    els.rotateBtn.addEventListener('click', toggleOrientation);
    els.moveRotateBtn.addEventListener('click', toggleOrientation);
    els.randomBtn.addEventListener('click', randomPlacement);
    els.clearBtn.addEventListener('click', clearPlacement);
    els.startBtn.addEventListener('click', startBattle);
    els.restartBtn.addEventListener('click', newGame);
    els.moveBtn.addEventListener('click', beginMove);
    els.cancelMoveBtn.addEventListener('click', cancelMove);
    els.playAgainBtn.addEventListener('click', newGame);
    els.closeOverlayBtn.addEventListener('click', hideOverlay);
    els.heatAiBtn.addEventListener('click', () => showHeatmap('ai'));
    els.heatPlayerBtn.addEventListener('click', () => showHeatmap('player'));
    els.difficulty.addEventListener('change', () => {
      if (state.phase === 'battle') return;
      state.ai = new B.AI(els.difficulty.value);
      state.persona = Personas.forDifficulty(els.difficulty.value);
      state.lastLine = null;
      renderPersona();
      say('start');
    });
    els.theme.addEventListener('change', () => applyTheme(els.theme.value));
    els.muteBtn.addEventListener('click', () => {
      Sound.setMuted(!Sound.isMuted());
      renderMute();
      Sound.play('fire');
    });
  }

  for (const t of Themes.list) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    els.theme.appendChild(opt);
  }
  buildGrid(els.playerBoard);
  buildGrid(els.enemyBoard);
  bindEvents();
  applyTheme(loadThemeId());
  renderMute();
  renderStats();
  newGame();
})();
