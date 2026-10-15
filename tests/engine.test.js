const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/engine.js');

// Small deterministic PRNG so failures are reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const def = (id) => B.FLEET.find((d) => d.id === id);

test('ships cannot go off the board', () => {
  const b = B.createBoard();
  assert.strictEqual(B.placeShip(b, def('carrier'), 0, 6, true), false);
  assert.strictEqual(B.placeShip(b, def('carrier'), 6, 0, false), false);
  assert.strictEqual(B.placeShip(b, def('carrier'), 0, 5, true), true);
  assert.strictEqual(B.placeShip(b, def('battleship'), -1, 0, true), false);
});

test('ships cannot overlap and cannot be placed twice', () => {
  const b = B.createBoard();
  assert.ok(B.placeShip(b, def('carrier'), 2, 2, true));
  assert.strictEqual(B.placeShip(b, def('battleship'), 0, 4, false), false);
  assert.strictEqual(B.placeShip(b, def('carrier'), 5, 5, true), false);
});

test('removeShip frees its cells', () => {
  const b = B.createBoard();
  B.placeShip(b, def('cruiser'), 4, 4, false);
  B.removeShip(b, 'cruiser');
  assert.strictEqual(b.ships.length, 0);
  assert.ok(b.cells.flat().every((c) => c.shipId === null));
  assert.ok(B.placeShip(b, def('cruiser'), 4, 4, true));
});

test('randomFleet always produces a legal full fleet', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 2000; i++) {
    const b = B.randomFleet(rng);
    assert.strictEqual(b.ships.length, B.FLEET.length);
    const occupied = b.cells.flat().filter((c) => c.shipId !== null).length;
    assert.strictEqual(occupied, 17);
    for (const s of b.ships) {
      for (const [r, c] of s.cells) assert.ok(B.inBounds(r, c));
    }
  }
});

test('receiveShot reports miss, hit, sunk, repeat and invalid', () => {
  const b = B.createBoard();
  B.placeShip(b, def('destroyer'), 0, 0, true);
  assert.strictEqual(B.receiveShot(b, 5, 5).result, 'miss');
  assert.strictEqual(B.receiveShot(b, 5, 5).result, 'repeat');
  assert.strictEqual(B.receiveShot(b, 0, 0).result, 'hit');
  assert.strictEqual(B.receiveShot(b, 0, 0).result, 'repeat');
  assert.strictEqual(B.allSunk(b), false);
  const r = B.receiveShot(b, 0, 1);
  assert.strictEqual(r.result, 'sunk');
  assert.strictEqual(r.ship.id, 'destroyer');
  assert.strictEqual(B.allSunk(b), true);
  assert.strictEqual(B.receiveShot(b, 10, 0).result, 'invalid');
  assert.strictEqual(B.receiveShot(b, 0, -1).result, 'invalid');
});

test('an empty board is not "all sunk"', () => {
  assert.strictEqual(B.allSunk(B.createBoard()), false);
});

function playAiGame(difficulty, seed) {
  const rng = mulberry32(seed);
  const board = B.randomFleet(rng);
  const ai = new B.AI(difficulty, rng);
  const seen = new Set();
  let shots = 0;
  while (!B.allSunk(board)) {
    const [r, c] = ai.nextShot();
    assert.ok(B.inBounds(r, c), `${difficulty}: out of bounds shot ${r},${c}`);
    const key = r * 10 + c;
    assert.ok(!seen.has(key), `${difficulty}: repeated shot at ${r},${c} (seed ${seed})`);
    seen.add(key);
    const outcome = B.receiveShot(board, r, c);
    ai.record(r, c, outcome);
    shots++;
    assert.ok(shots <= 100, `${difficulty}: more than 100 shots`);
  }
  return shots;
}

for (const difficulty of ['easy', 'normal', 'hard']) {
  test(`AI (${difficulty}) never repeats a shot and always finishes`, () => {
    let total = 0;
    const games = difficulty === 'hard' ? 300 : 1000;
    for (let seed = 1; seed <= games; seed++) total += playAiGame(difficulty, seed);
    console.log(`  ${difficulty}: average ${(total / games).toFixed(1)} shots to win`);
  });
}

test('harder AI needs fewer shots on average', () => {
  const avg = (d, n) => {
    let t = 0;
    for (let s = 5000; s < 5000 + n; s++) t += playAiGame(d, s);
    return t / n;
  };
  const easy = avg('easy', 200), normal = avg('normal', 200), hard = avg('hard', 200);
  assert.ok(normal < easy, `normal ${normal} should beat easy ${easy}`);
  assert.ok(hard < normal, `hard ${hard} should beat normal ${normal}`);
});

test('AI tracks the two 3-length ships separately', () => {
  const ai = new B.AI('normal');
  const b = B.createBoard();
  B.placeShip(b, def('cruiser'), 0, 0, true);
  for (let c = 0; c < 3; c++) ai.record(0, c, B.receiveShot(b, 0, c));
  assert.deepStrictEqual(ai.remaining.slice().sort(), [2, 3, 4, 5]);
});

test('moveShip relocates an undamaged ship', () => {
  const b = B.createBoard();
  B.placeShip(b, def('cruiser'), 0, 0, true);
  assert.ok(B.moveShip(b, 'cruiser', 5, 5, false));
  assert.strictEqual(b.cells[0][0].shipId, null);
  assert.strictEqual(b.cells[7][5].shipId, 'cruiser');
  assert.deepStrictEqual(B.getShip(b, 'cruiser').cells, [[5, 5], [6, 5], [7, 5]]);
  assert.strictEqual(B.receiveShot(b, 6, 5).result, 'hit');
});

test('moveShip may overlap its own old position', () => {
  const b = B.createBoard();
  B.placeShip(b, def('carrier'), 0, 0, true);
  assert.ok(B.moveShip(b, 'carrier', 0, 1, true));
  assert.strictEqual(b.cells[0][0].shipId, null);
  assert.strictEqual(b.cells[0][5].shipId, 'carrier');
});

test('moveShip rejects damaged ships, shot squares, overlaps and off-board', () => {
  const b = B.createBoard();
  B.placeShip(b, def('cruiser'), 0, 0, true);
  B.placeShip(b, def('destroyer'), 2, 0, true);
  B.receiveShot(b, 5, 5);
  assert.strictEqual(B.moveShip(b, 'cruiser', 5, 4, true), false, 'covers a fired-at square');
  assert.strictEqual(B.moveShip(b, 'cruiser', 2, 1, true), false, 'overlaps destroyer');
  assert.strictEqual(B.moveShip(b, 'cruiser', 0, 8, true), false, 'off board');
  assert.strictEqual(B.moveShip(b, 'cruiser', 0, 0, true), false, 'same spot is not a move');
  B.receiveShot(b, 2, 0);
  assert.strictEqual(B.moveShip(b, 'destroyer', 8, 8, true), false, 'damaged ship');
  assert.strictEqual(B.getShip(b, 'cruiser').cells[0][1], 0, 'failed moves leave ship in place');
});

test('AI still finishes when a ship is moved mid-game', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = mulberry32(seed);
    const board = B.randomFleet(rng);
    const ai = new B.AI(['easy', 'normal', 'hard'][seed % 3], rng);
    let shots = 0, moved = false;
    while (!B.allSunk(board)) {
      if (!moved && shots === 20) {
        for (const ship of board.ships) {
          for (let k = 0; k < 200 && !moved; k++) {
            moved = B.moveShip(board, ship.id, Math.floor(rng() * 10), Math.floor(rng() * 10), rng() < 0.5);
          }
          if (moved) break;
        }
      }
      const [r, c] = ai.nextShot();
      ai.record(r, c, B.receiveShot(board, r, c));
      assert.ok(++shots <= 100, `seed ${seed}: AI could not finish after a move`);
    }
  }
});
