/*
 * Battleship game engine: board model, ship placement, shooting and the AI.
 * Pure logic with no DOM access so it can be unit-tested in Node.
 */
(function (root) {
  'use strict';

  const SIZE = 10;

  const FLEET = [
    { id: 'carrier', name: 'Carrier', size: 5 },
    { id: 'battleship', name: 'Battleship', size: 4 },
    { id: 'cruiser', name: 'Cruiser', size: 3 },
    { id: 'submarine', name: 'Submarine', size: 3 },
    { id: 'destroyer', name: 'Destroyer', size: 2 },
  ];

  function inBounds(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function createBoard() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) row.push({ shipId: null, shot: false });
      cells.push(row);
    }
    return { cells, ships: [] };
  }

  function shipCells(row, col, size, horizontal) {
    const out = [];
    for (let i = 0; i < size; i++) {
      out.push(horizontal ? [row, col + i] : [row + i, col]);
    }
    return out;
  }

  function canPlace(board, row, col, size, horizontal) {
    return shipCells(row, col, size, horizontal).every(
      ([r, c]) => inBounds(r, c) && board.cells[r][c].shipId === null
    );
  }

  function placeShip(board, def, row, col, horizontal) {
    if (board.ships.some((s) => s.id === def.id)) return false;
    if (!canPlace(board, row, col, def.size, horizontal)) return false;
    const cells = shipCells(row, col, def.size, horizontal);
    cells.forEach(([r, c]) => { board.cells[r][c].shipId = def.id; });
    board.ships.push({
      id: def.id, name: def.name, size: def.size,
      row, col, horizontal, cells, hits: 0,
    });
    return true;
  }

  function removeShip(board, shipId) {
    const i = board.ships.findIndex((s) => s.id === shipId);
    if (i === -1) return null;
    const [ship] = board.ships.splice(i, 1);
    ship.cells.forEach(([r, c]) => { board.cells[r][c].shipId = null; });
    return ship;
  }

  // A ship can be moved only if it has not been hit, and its new position
  // may not cover any square that has already been fired at (otherwise the
  // shooter's earlier "miss" information would become a lie).
  function canMoveShip(board, shipId, row, col, horizontal) {
    const ship = getShip(board, shipId);
    if (!ship || ship.hits > 0) return false;
    return shipCells(row, col, ship.size, horizontal).every(([r, c]) => {
      if (!inBounds(r, c)) return false;
      const cell = board.cells[r][c];
      return !cell.shot && (cell.shipId === null || cell.shipId === shipId);
    });
  }

  function moveShip(board, shipId, row, col, horizontal) {
    if (!canMoveShip(board, shipId, row, col, horizontal)) return false;
    const ship = getShip(board, shipId);
    if (ship.row === row && ship.col === col && ship.horizontal === horizontal) return false;
    ship.cells.forEach(([r, c]) => { board.cells[r][c].shipId = null; });
    ship.cells = shipCells(row, col, ship.size, horizontal);
    ship.cells.forEach(([r, c]) => { board.cells[r][c].shipId = shipId; });
    Object.assign(ship, { row, col, horizontal });
    return true;
  }

  function getShip(board, shipId) {
    return board.ships.find((s) => s.id === shipId) || null;
  }

  function randomInt(rng, n) {
    return Math.floor(rng() * n);
  }

  function randomFleet(rng) {
    rng = rng || Math.random;
    for (;;) {
      const board = createBoard();
      let ok = true;
      for (const def of FLEET) {
        let placed = false;
        for (let attempt = 0; attempt < 500 && !placed; attempt++) {
          const horizontal = rng() < 0.5;
          const row = randomInt(rng, SIZE);
          const col = randomInt(rng, SIZE);
          placed = placeShip(board, def, row, col, horizontal);
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return board;
    }
  }

  function isSunk(ship) {
    return ship.hits >= ship.size;
  }

  // Returns { result: 'miss' | 'hit' | 'sunk' | 'repeat' | 'invalid', ship? }
  function receiveShot(board, row, col) {
    if (!inBounds(row, col)) return { result: 'invalid' };
    const cell = board.cells[row][col];
    if (cell.shot) return { result: 'repeat' };
    cell.shot = true;
    if (cell.shipId === null) return { result: 'miss' };
    const ship = getShip(board, cell.shipId);
    ship.hits++;
    if (isSunk(ship)) return { result: 'sunk', ship };
    return { result: 'hit', ship };
  }

  function allSunk(board) {
    return board.ships.length > 0 && board.ships.every(isSunk);
  }

  // ---------------------------------------------------------------------
  // AI opponent. It only learns what a human would: miss / hit / sunk.
  // When a ship is sunk its cells are revealed (as they are to the player).
  // ---------------------------------------------------------------------
  const UNKNOWN = 0, MISS = 1, HIT = 2, SUNK = 3;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  class AI {
    constructor(difficulty, rng) {
      this.difficulty = difficulty || 'normal';
      this.rng = rng || Math.random;
      this.reset();
    }

    reset() {
      this.grid = [];
      for (let r = 0; r < SIZE; r++) this.grid.push(new Array(SIZE).fill(UNKNOWN));
      this.remaining = FLEET.map((s) => s.size);
    }

    unknownCells() {
      const out = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) if (this.grid[r][c] === UNKNOWN) out.push([r, c]);
      }
      return out;
    }

    openHits() {
      const out = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) if (this.grid[r][c] === HIT) out.push([r, c]);
      }
      return out;
    }

    pick(list) {
      return list[randomInt(this.rng, list.length)];
    }

    nextShot() {
      if (this.difficulty === 'easy') return this.easyShot();
      if (this.difficulty === 'hard') return this.densityShot();
      return this.huntTargetShot();
    }

    isUnknown(r, c) {
      return inBounds(r, c) && this.grid[r][c] === UNKNOWN;
    }

    // Easy: random shots, but usually follows up on a hit next door.
    easyShot() {
      const adjacent = [];
      for (const [r, c] of this.openHits()) {
        for (const [dr, dc] of DIRS) {
          if (this.isUnknown(r + dr, c + dc)) adjacent.push([r + dr, c + dc]);
        }
      }
      if (adjacent.length > 0 && this.rng() < 0.6) return this.pick(adjacent);
      return this.pick(this.unknownCells());
    }

    // Normal: checkerboard hunting, then follow up on hits.
    huntTargetShot() {
      const hits = this.openHits();
      if (hits.length > 0) {
        const candidates = this.lineCandidates(hits);
        if (candidates.length > 0) return this.pick(candidates);
        const adjacent = [];
        for (const [r, c] of hits) {
          for (const [dr, dc] of DIRS) {
            if (this.isUnknown(r + dr, c + dc)) adjacent.push([r + dr, c + dc]);
          }
        }
        if (adjacent.length > 0) return this.pick(adjacent);
      }
      const minShip = Math.min.apply(null, this.remaining);
      const parity = this.unknownCells().filter(([r, c]) => (r + c) % minShip === 0);
      if (parity.length > 0) return this.pick(parity);
      return this.pick(this.unknownCells());
    }

    // When two or more open hits line up, try to extend the line.
    lineCandidates(hits) {
      const out = [];
      const key = (r, c) => r * SIZE + c;
      const hitSet = new Set(hits.map(([r, c]) => key(r, c)));
      for (const [r, c] of hits) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          if (!hitSet.has(key(r + dr, c + dc))) continue;
          // walk to both ends of this line of hits
          let r1 = r, c1 = c;
          while (hitSet.has(key(r1 - dr, c1 - dc))) { r1 -= dr; c1 -= dc; }
          let r2 = r, c2 = c;
          while (hitSet.has(key(r2 + dr, c2 + dc))) { r2 += dr; c2 += dc; }
          if (this.isUnknown(r1 - dr, c1 - dc)) out.push([r1 - dr, c1 - dc]);
          if (this.isUnknown(r2 + dr, c2 + dc)) out.push([r2 + dr, c2 + dc]);
        }
      }
      return out;
    }

    // Hard: probability density over every legal placement of remaining ships.
    densityShot() {
      const scores = [];
      for (let r = 0; r < SIZE; r++) scores.push(new Array(SIZE).fill(0));
      const hits = this.openHits();
      const targeting = hits.length > 0;

      for (const size of this.remaining) {
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            for (const horizontal of [true, false]) {
              const cells = shipCells(r, c, size, horizontal);
              let valid = true, hitCount = 0;
              for (const [cr, cc] of cells) {
                if (!inBounds(cr, cc)) { valid = false; break; }
                const v = this.grid[cr][cc];
                if (v === MISS || v === SUNK) { valid = false; break; }
                if (v === HIT) hitCount++;
              }
              if (!valid) continue;
              if (targeting && hitCount === 0) continue;
              const weight = targeting ? Math.pow(10, hitCount) : 1;
              for (const [cr, cc] of cells) {
                if (this.grid[cr][cc] === UNKNOWN) scores[cr][cc] += weight;
              }
            }
          }
        }
      }

      let best = -1, bestCells = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (this.grid[r][c] !== UNKNOWN) continue;
          if (scores[r][c] > best) { best = scores[r][c]; bestCells = [[r, c]]; }
          else if (scores[r][c] === best) bestCells.push([r, c]);
        }
      }
      return this.pick(bestCells);
    }

    // outcome: result of receiveShot()
    record(row, col, outcome) {
      if (outcome.result === 'miss') this.grid[row][col] = MISS;
      else if (outcome.result === 'hit') this.grid[row][col] = HIT;
      else if (outcome.result === 'sunk') {
        outcome.ship.cells.forEach(([r, c]) => { this.grid[r][c] = SUNK; });
        const i = this.remaining.indexOf(outcome.ship.size);
        if (i !== -1) this.remaining.splice(i, 1);
      }
    }
  }

  const api = {
    SIZE, FLEET, inBounds, createBoard, shipCells, canPlace, placeShip,
    removeShip, getShip, canMoveShip, moveShip, randomFleet, receiveShot, allSunk, isSunk, AI,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Battleship = api;
})(typeof window !== 'undefined' ? window : this);
