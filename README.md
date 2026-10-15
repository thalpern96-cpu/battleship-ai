# Battleship vs AI

The classic game of Battleship, played in the browser against a computer opponent.

**Play it here: https://thalpern96-cpu.github.io/battleship-ai/**

## How to play

1. **Place your fleet.** Click a ship in the list under your board, then click a square on your board.
   Press **R** (or the *Rotate* button) to switch between horizontal and vertical.
   Click a ship you've already placed to pick it up and move it, or use **Random placement**.
2. Click **Start battle**.
3. **Fire** by clicking squares in *Enemy waters*. Red ✕ = hit, white dot = miss, dark red = sunk.
   The AI fires back after each of your shots.
4. The first side to sink all 5 enemy ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2) wins.

### AI difficulty

| Level  | Strategy | Avg. shots to sink a fleet* |
|--------|----------|-----------------------------|
| Easy   | Random shots, usually follows up on a hit | ~65 |
| Normal | Checkerboard search, then hunts along the line of hits | ~51 |
| Hard   | Probability map of every place the remaining ships could be | ~46 |

\* measured by the automated tests over hundreds of simulated games. The AI never sees where your ships are; it only learns hit / miss / sunk, just like you.

## Project layout

```
index.html        page markup
css/style.css     styling (responsive, works on phones)
js/engine.js      game rules + AI (no DOM, unit-tested)
js/app.js         user interface
tests/            automated tests (Node's built-in test runner)
BUGS.md           bugs found during testing and how they were fixed
```

No build step or dependencies: it's plain HTML, CSS and JavaScript.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # runs the engine + AI tests (Node 18+)
```
