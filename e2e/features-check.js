const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8000/';
const OUT = process.env.OUT || __dirname;
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('FAIL:', msg); } else console.log('ok:', msg); };
const waitTurn = (page) => page.waitForFunction(() =>
  document.querySelector('#enemy-board').classList.contains('targetable') ||
  !document.querySelector('#overlay').classList.contains('hidden'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
  await page.goto(URL);

  // Personas
  check((await page.textContent('#persona-name')) === 'Austin Mead', 'normal difficulty persona is Austin Mead');
  check((await page.textContent('#persona-bubble')).length > 5, 'persona greets the player');
  await page.selectOption('#difficulty', 'hard');
  check((await page.textContent('#persona-name')) === 'Chris Degnan', 'hard difficulty persona is Chris Degnan');
  await page.selectOption('#difficulty', 'easy');
  check((await page.textContent('#persona-name')) === 'Arif Shenoy', 'easy difficulty persona is Arif Shenoy');
  await page.selectOption('#difficulty', 'normal');

  // Themes
  for (const [id, ship, board] of [['pirate', 'Galleon', 'Enemy seas'], ['space', 'Mothership', 'Deep space'], ['sonar', 'Boomer', 'Sonar contacts'], ['classic', 'Carrier', 'Enemy waters']]) {
    await page.selectOption('#theme', id);
    check(await page.evaluate(() => document.body.dataset.theme) === id, `theme ${id} applied`);
    check((await page.textContent('#player-ships')).includes(ship), `${id} ship names (${ship})`);
    check((await page.textContent('#enemy-board-title')) === board, `${id} board title`);
  }
  await page.selectOption('#theme', 'pirate');
  await page.reload();
  check(await page.evaluate(() => document.body.dataset.theme) === 'pirate', 'theme remembered after reload');

  // Mute
  const before = await page.textContent('#mute-btn');
  await page.click('#mute-btn');
  check((await page.textContent('#mute-btn')) !== before, 'mute button toggles');
  await page.reload();
  check((await page.textContent('#mute-btn')).includes('off'), 'mute remembered after reload');
  await page.click('#mute-btn');

  // Battle + effects
  await page.click('#random-btn');
  await page.click('#start-btn');
  check(!(await page.isDisabled('#move-btn')), 'move button available in battle');
  await page.click('#enemy-board .cell >> nth=0');
  check(await page.locator('#enemy-board .fx').count() > 0, 'shot effect animation appears');
  await waitTurn(page);

  // Move: cancel first
  await page.click('#move-btn');
  check(await page.locator('#player-board .movable').count() > 0, 'undamaged ships outlined when moving');
  check(await page.locator('#enemy-board.targetable').count() === 0, 'cannot fire while choosing a ship to move');
  await page.keyboard.press('Escape');
  check((await page.textContent('#status')).includes('cancelled'), 'Escape cancels the move');
  check(!(await page.isDisabled('#move-btn')), 'cancelled move is not used up');

  // Move for real
  const aiShotsBefore = await page.locator('#player-board .miss, #player-board .hit').count();
  await page.click('#move-btn');
  const movable = page.locator('#player-board .cell.movable').first();
  await movable.click();
  const lifted = await page.locator('#player-board .lifted').count();
  check(lifted >= 2, `ship lifted (${lifted} cells)`);
  // hovering a square already fired at must show an invalid preview
  const lastShot = await page.$('#player-board .cell.last-shot');
  if (lastShot) {
    await lastShot.hover();
    check(await page.locator('#player-board .preview-invalid').count() > 0, 'cannot move onto a square already fired at');
  }
  let placed = false;
  for (let i = 99; i >= 0 && !placed; i--) {
    const cell = page.locator(`#player-board .cell >> nth=${i}`);
    await cell.hover();
    const valid = await page.locator('#player-board .preview-valid').count();
    const invalid = await page.locator('#player-board .preview-invalid').count();
    if (valid === lifted && invalid === 0 && !(await cell.evaluate((el) => el.classList.contains('lifted')))) {
      await cell.click();
      placed = true;
    }
  }
  check(placed, 'found a valid new spot and moved the ship');
  check((await page.textContent('#log')).includes('moved your'), 'move logged');
  await waitTurn(page);
  check(await page.locator('#player-board .miss, #player-board .hit').count() === aiShotsBefore + 1, 'moving used the turn (AI fired once)');
  check(await page.locator('#player-board .ship').count() === 17, 'still 17 ship squares after move');
  check(await page.isDisabled('#move-btn') && (await page.textContent('#move-btn')).includes('used'), 'move can only be used once');
  await page.screenshot({ path: OUT + '/theme-pirate.png' });

  // Theme screenshots mid-game
  for (const id of ['space', 'sonar', 'classic']) {
    await page.selectOption('#theme', id);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/theme-${id}.png` });
  }

  // Finish the game
  for (let i = 1; i < 100; i++) {
    await waitTurn(page);
    if (await page.isVisible('#overlay')) break;
    const el = page.locator(`#enemy-board .cell >> nth=${i}`);
    if (await el.isDisabled()) continue;
    await el.click();
  }
  await page.waitForSelector('#overlay:not(.hidden)');
  await page.waitForTimeout(500);
  check(await page.locator('#end-stats tbody tr').count() === 5, 'end stats table has 5 rows');
  check(await page.locator('#sink-timeline li').count() >= 5, 'sink timeline lists sunk ships');
  check(await page.locator('#heatmap .heat-cell').count() === 100, 'heat map has 100 squares');
  const aiLog = await page.locator('#log li.ai').count();
  check(await page.locator('#heatmap .heat-cell.shot').count() === aiLog, `AI heat map shows every AI shot (${aiLog})`);
  check(await page.locator('#heatmap .ship-outline').count() === 17, 'heat map outlines your ships');
  check((await page.textContent('#overlay-quote')).length > 5, 'persona has a parting line');
  await page.screenshot({ path: OUT + '/end-screen.png' });
  await page.click('#heat-player-btn');
  const playerShots = (await page.locator('#log li.player').count()) - 1; // minus the move entry
  check(await page.locator('#heatmap .heat-cell.shot').count() === playerShots, `player heat map shows every player shot (${playerShots})`);
  await page.click('#play-again-btn');
  check(!(await page.isVisible('#overlay')), 'play again closes end screen');

  // Mobile end screen fits
  const m = await browser.newPage({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  m.on('pageerror', (e) => problems.push('mobile page error: ' + e.message));
  await m.goto(URL);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 375, `no horizontal scroll on mobile (scrollWidth ${sw})`);
  await m.screenshot({ path: OUT + '/mobile-theme.png', fullPage: true });

  await browser.close();
  console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n` + problems.join('\n') : '\nALL FEATURE CHECKS PASSED');
  process.exit(problems.length ? 1 : 0);
})();
