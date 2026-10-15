const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8000/';
const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('FAIL:', msg); } else console.log('ok:', msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  await page.goto(URL);

  // Start disabled until all placed
  check(await page.isDisabled('#start-btn'), 'start disabled before placement');

  // Manual placement: carrier horizontal at A1
  const pcell = (r, c) => `#player-board .cell >> nth=${r * 10 + c}`;
  const ecell = (r, c) => `#enemy-board .cell >> nth=${r * 10 + c}`;
  await page.hover(pcell(0, 7));
  check(await page.locator('#player-board .preview-invalid').count() === 3, 'invalid preview clipped at edge (3 cells shown red)');
  await page.click(pcell(0, 7));
  check(await page.locator('#player-board .ship').count() === 0, 'off-board carrier rejected');
  await page.click(pcell(0, 0));
  check(await page.locator('#player-board .ship').count() === 5, 'carrier placed');
  await page.keyboard.press('r');
  check((await page.textContent('#orientation-label')) === 'Vertical', 'R rotates to vertical');
  await page.click(pcell(0, 0)); // clicking existing ship picks it up
  check(await page.locator('#player-board .ship').count() === 0, 'clicking a placed ship picks it up');
  await page.click(pcell(0, 0));
  check(await page.locator('#player-board .ship').count() === 5, 'carrier re-placed (orientation restored)');
  check((await page.textContent('#orientation-label')) === 'Horizontal', 'picked-up ship keeps its orientation');
  for (let r = 1; r <= 4; r++) await page.click(pcell(r * 2, 0));
  check(await page.locator('#player-board .ship').count() === 17, 'all 17 ship cells placed manually');
  check(!(await page.isDisabled('#start-btn')), 'start enabled after placement');

  // Hovering a placed ship must keep it ship-coloured
  await page.hover(pcell(0, 1));
  const hoverBg = await page.$eval('#player-board .cell >> nth=1', (el) => getComputedStyle(el).backgroundColor);
  check(hoverBg === 'rgb(138, 150, 163)', `hovered ship cell stays grey (${hoverBg})`);

  // Randomize works
  await page.click('#random-btn');
  check(await page.locator('#player-board .ship').count() === 17, 'random placement gives 17 cells');

  // Clicking enemy board before battle does nothing
  await page.click(ecell(0, 0), { force: true });
  check(await page.locator('#enemy-board .miss, #enemy-board .hit').count() === 0, 'cannot fire before battle');

  await page.click('#start-btn');
  check(await page.isDisabled('#difficulty'), 'difficulty locked during battle');

  // Rapid double click during AI turn must only fire once
  await page.click(ecell(0, 0));
  await page.click(ecell(0, 1), { force: true });
  check(await page.locator('#enemy-board .miss, #enemy-board .hit').count() === 1, 'no second shot while AI is thinking');
  await page.waitForFunction(() => document.querySelectorAll('#player-board .miss, #player-board .hit').length === 1);
  check(true, 'AI fired back once');
  const opacity = await page.$eval('#player-board .cell >> nth=0', (el) => getComputedStyle(el).opacity);
  check(opacity === '1', `player board not dimmed during battle (opacity ${opacity})`);
  const topLogNumber = await page.$eval('#log', (ol) => ol.reversed && ol.children.length);
  check(topLogNumber === 3, 'newest log entry has the highest number');

  // Restart while AI is thinking must not let the old AI shot land on the new board
  await page.click(ecell(0, 1));
  await page.click('#restart-btn');
  await page.waitForTimeout(1000);
  check(await page.locator('#player-board .miss, #player-board .hit').count() === 0, 'restart mid-AI-turn cancels pending AI shot');
  check((await page.locator('#log li').count()) === 0, 'log cleared on restart');

  // Play a full game: fire at every enemy cell in order
  await page.click('#random-btn');
  await page.click('#start-btn');
  let fired = 0;
  for (let i = 0; i < 100; i++) {
    if (await page.isVisible('#overlay')) break;
    const el = page.locator(`#enemy-board .cell >> nth=${i}`);
    await page.waitForFunction(() => document.querySelector('#enemy-board').classList.contains('targetable') || !document.querySelector('#overlay').classList.contains('hidden'));
    if (await page.isVisible('#overlay')) break;
    await el.click();
    fired++;
  }
  await page.waitForSelector('#overlay:not(.hidden)');
  const title = await page.textContent('#overlay-title');
  console.log('game over:', title, 'after', fired, 'player shots');
  check(/win|lose/i.test(title), 'game-over overlay shown');
  const shots = await page.locator('#log li.player').count();
  const aiShots = await page.locator('#log li.ai').count();
  check(shots === fired, `player shot count in log matches (${shots} vs ${fired})`);
  check(/win/i.test(title) ? aiShots === shots - 1 : aiShots === shots, `turn order consistent (player ${shots}, ai ${aiShots})`);
  check(/Wins: \d+ · Losses: \d+/.test(await page.textContent('#stats')), 'stats displayed');
  await page.screenshot({ path: __dirname + '/gameover.png', fullPage: true });
  await page.click('#close-overlay-btn');
  check(!(await page.isVisible('#overlay')), 'View boards closes overlay');
  if (/lose/i.test(title)) check(await page.locator('#enemy-board .revealed').count() > 0, 'enemy ships revealed on loss');
  await page.click('#restart-btn');
  check(!(await page.isDisabled('#difficulty')), 'new game re-enables difficulty');

  // Mobile layout
  const m = await browser.newPage({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  m.on('pageerror', (e) => problems.push('mobile page error: ' + e.message));
  await m.goto(URL);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 375, `no horizontal scroll on mobile (scrollWidth ${sw})`);
  await m.tap('#player-board .cell >> nth=0');
  check(await m.locator('#player-board .ship').count() === 5, 'tap places ship on mobile');
  await m.screenshot({ path: __dirname + '/mobile.png', fullPage: true });

  // Midgame screenshot
  await page.click('#random-btn'); await page.click('#start-btn');
  for (const i of [11, 23, 45, 56, 67]) {
    await page.waitForFunction(() => document.querySelector('#enemy-board').classList.contains('targetable'));
    await page.click(`#enemy-board .cell >> nth=${i}`);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: __dirname + '/midgame.png', fullPage: true });

  await browser.close();
  console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n` + problems.join('\n') : '\nALL E2E CHECKS PASSED');
  process.exit(problems.length ? 1 : 0);
})();
