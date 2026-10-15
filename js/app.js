/* Battleship UI: wires the engine to the page. */
(function () {
  'use strict';

  const B = window.Battleship;
  const ROWS = 'ABCDEFGHIJ';
  const AI_DELAY_MS = 650;
  const STATS_KEY = 'battleship-ai-stats';

  const $ = (id) => document.getElementById(id);
  const els = {
    difficulty: $('difficulty'),
    stats: $('stats'),
    placementControls: $('placement-controls'),
    battleControls: $('battle-controls'),
    rotateBtn: $('rotate-btn'),
    orientationLabel: $('orientation-label'),
    randomBtn: $('random-btn'),
    clearBtn: $('clear-btn'),
    startBtn: $('start-btn'),
    restartBtn: $('restart-btn'),
    status: $('status'),
    playerBoard: $('player-board'),
    enemyBoard: $('enemy-board'),
    playerShips: $('player-ships'),
    enemyShips: $('enemy-ships'),
    log: $('log'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayText: $('overlay-text'),
    playAgainBtn: $('play-again-btn'),
    closeOverlayBtn: $('close-overlay-btn'),
  };

  let state = null;
  let aiTimer = null;
  let hoverCell = null;

  const coord = (r, c) => ROWS[r] + (c + 1);

  // ---------- stats ----------
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

  // ---------- board DOM ----------
  function buildGrid(container, owner) {
    container.innerHTML = '';
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.row = r;
        btn.dataset.col = c;
        btn.dataset.owner = owner;
        container.appendChild(btn);
      }
    }
  }

  function cellEl(container, r, c) {
    return container.children[r * B.SIZE + c];
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
      horizontal: true,
      selectedShip: B.FLEET[0].id,
      aiThinking: false,
      shots: 0,
      hits: 0,
      lastPlayerShot: null,
      lastAiShot: null,
    };
    els.log.innerHTML = '';
    hideOverlay();
    setStatus('Place your ships. Pick a ship below your board, then click a square.');
    render();
  }

  function startBattle() {
    if (state.phase !== 'placement' || state.player.ships.length !== B.FLEET.length) return;
    state.phase = 'battle';
    state.selectedShip = null;
    state.ai = new B.AI(els.difficulty.value);
    clearPreview();
    addLog('system', `Battle started (AI: ${els.difficulty.value}). You fire first.`);
    setStatus('Your turn — fire at Enemy waters.');
    render();
  }

  function endGame(playerWon) {
    state.phase = 'over';
    state.aiThinking = false;
    const s = loadStats();
    if (playerWon) s.wins++; else s.losses++;
    saveStats(s);
    renderStats();
    const accuracy = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
    const summary = `You fired ${state.shots} shots with ${accuracy}% accuracy.`;
    if (playerWon) {
      setStatus('Victory! You sank the entire enemy fleet.');
      showOverlay('You win! 🎉', summary);
    } else {
      setStatus('Defeat. The AI sank your fleet.');
      showOverlay('You lose', `${summary} The enemy's remaining ships are now revealed.`);
    }
    render();
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
    if (state.phase !== 'placement') return;
    const existing = state.player.cells[r][c].shipId;
    if (existing) {
      const ship = B.removeShip(state.player, existing);
      state.selectedShip = ship.id;
      state.horizontal = ship.horizontal;
      setStatus(`Picked up your ${ship.name}. Click to place it again.`);
    } else {
      const def = selectedDef();
      if (!def) return;
      if (B.placeShip(state.player, def, r, c, state.horizontal)) {
        state.selectedShip = nextUnplacedShip();
        setStatus(state.selectedShip
          ? 'Ship placed. Place the next one.'
          : 'All ships placed! Press "Start battle". (Click a ship to move it.)');
      } else {
        setStatus(`The ${def.name} doesn't fit there.`);
      }
    }
    render();
    showPreview(r, c);
  }

  function toggleOrientation() {
    if (state.phase !== 'placement') return;
    state.horizontal = !state.horizontal;
    renderControls();
    if (hoverCell) showPreview(hoverCell[0], hoverCell[1]);
  }

  function clearPreview() {
    for (const el of els.playerBoard.children) {
      el.classList.remove('preview-valid', 'preview-invalid');
    }
  }

  function showPreview(r, c) {
    clearPreview();
    if (state.phase !== 'placement') return;
    const def = selectedDef();
    if (!def || state.player.cells[r][c].shipId) return;
    const valid = B.canPlace(state.player, r, c, def.size, state.horizontal);
    for (const [pr, pc] of B.shipCells(r, c, def.size, state.horizontal)) {
      if (!B.inBounds(pr, pc)) continue;
      cellEl(els.playerBoard, pr, pc).classList.add(valid ? 'preview-valid' : 'preview-invalid');
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

  // ---------- battle ----------
  function onEnemyCellClick(r, c) {
    if (state.phase !== 'battle' || state.aiThinking) return;
    const outcome = B.receiveShot(state.enemy, r, c);
    if (outcome.result === 'repeat' || outcome.result === 'invalid') return;

    state.shots++;
    state.lastPlayerShot = [r, c];
    if (outcome.result === 'miss') {
      addLog('player', `You fired at ${coord(r, c)}: miss.`);
    } else {
      state.hits++;
      if (outcome.result === 'sunk') {
        addLog('player', `You fired at ${coord(r, c)}: you sank their ${outcome.ship.name}!`);
      } else {
        addLog('player', `You fired at ${coord(r, c)}: hit!`);
      }
    }

    if (B.allSunk(state.enemy)) {
      endGame(true);
      return;
    }

    state.aiThinking = true;
    setStatus('Enemy is aiming…');
    render();
    aiTimer = setTimeout(aiTurn, AI_DELAY_MS);
  }

  function aiTurn() {
    aiTimer = null;
    if (!state || state.phase !== 'battle') return;
    const [r, c] = state.ai.nextShot();
    const outcome = B.receiveShot(state.player, r, c);
    state.ai.record(r, c, outcome);
    state.lastAiShot = [r, c];

    if (outcome.result === 'miss') addLog('ai', `Enemy fired at ${coord(r, c)}: miss.`);
    else if (outcome.result === 'sunk') addLog('ai', `Enemy fired at ${coord(r, c)}: they sank your ${outcome.ship.name}!`);
    else addLog('ai', `Enemy fired at ${coord(r, c)}: hit!`);

    if (B.allSunk(state.player)) {
      endGame(false);
      return;
    }
    state.aiThinking = false;
    setStatus('Your turn — fire at Enemy waters.');
    render();
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

  function showOverlay(title, text) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.overlay.classList.remove('hidden');
    els.playAgainBtn.focus();
  }

  function hideOverlay() {
    els.overlay.classList.add('hidden');
  }

  function renderControls() {
    const placing = state.phase === 'placement';
    els.placementControls.classList.toggle('hidden', !placing);
    els.battleControls.classList.toggle('hidden', placing);
    els.orientationLabel.textContent = state.horizontal ? 'Horizontal' : 'Vertical';
    els.startBtn.disabled = state.player.ships.length !== B.FLEET.length;
    els.difficulty.disabled = state.phase === 'battle';
  }

  function sameCell(a, r, c) {
    return a && a[0] === r && a[1] === c;
  }

  function renderPlayerBoard() {
    const board = state.player;
    els.playerBoard.classList.toggle('placing', state.phase === 'placement');
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
        if (sameCell(state.lastAiShot, r, c)) el.classList.add('last-shot');
        let label = `Your ${coord(r, c)}: `;
        label += ship ? (cell.shot ? (sunk ? `${ship.name}, sunk` : `${ship.name}, hit`) : ship.name) : (cell.shot ? 'miss' : 'water');
        el.setAttribute('aria-label', label);
        el.disabled = state.phase !== 'placement';
      }
    }
  }

  function renderEnemyBoard() {
    const board = state.enemy;
    const battle = state.phase === 'battle';
    els.enemyBoard.classList.toggle('targetable', battle && !state.aiThinking);
    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const cell = board.cells[r][c];
        const el = cellEl(els.enemyBoard, r, c);
        const ship = cell.shipId ? B.getShip(board, cell.shipId) : null;
        const sunk = ship && B.isSunk(ship);
        el.className = 'cell';
        let label = `Enemy ${coord(r, c)}: `;
        if (!cell.shot) {
          if (state.phase === 'over' && ship) { el.classList.add('revealed'); label += `${ship.name} (revealed)`; }
          else { el.classList.add('unknown'); label += 'not fired at'; }
        } else if (!ship) {
          el.classList.add('miss'); label += 'miss';
        } else if (sunk) {
          el.classList.add('sunk', 'hit'); label += `${ship.name}, sunk`;
        } else {
          el.classList.add('hit'); label += 'hit';
        }
        if (sameCell(state.lastPlayerShot, r, c)) el.classList.add('last-shot');
        el.setAttribute('aria-label', label);
        el.disabled = !battle || cell.shot;
      }
    }
  }

  function renderShipLists() {
    els.playerShips.innerHTML = '';
    for (const def of B.FLEET) {
      const li = document.createElement('li');
      const ship = B.getShip(state.player, def.id);
      li.textContent = `${def.name} (${def.size})`;
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
      li.textContent = `${def.name} (${def.size})`;
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
        hideOverlay();
      }
    });
    els.rotateBtn.addEventListener('click', toggleOrientation);
    els.randomBtn.addEventListener('click', randomPlacement);
    els.clearBtn.addEventListener('click', clearPlacement);
    els.startBtn.addEventListener('click', startBattle);
    els.restartBtn.addEventListener('click', newGame);
    els.playAgainBtn.addEventListener('click', newGame);
    els.closeOverlayBtn.addEventListener('click', hideOverlay);
    els.difficulty.addEventListener('change', () => {
      if (state.phase === 'placement') state.ai = new B.AI(els.difficulty.value);
    });
  }

  buildGrid(els.playerBoard, 'player');
  buildGrid(els.enemyBoard, 'enemy');
  bindEvents();
  renderStats();
  newGame();
})();
