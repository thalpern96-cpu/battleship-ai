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

## Extras

- **Themes:** pick Classic, Pirate, Space (asteroids and starships) or Submarine Sonar. Each has its own colours, full-screen animated background (ocean waves, a pirate sunset, an asteroid field, a sonar scope), board names and ship names. Your choice is remembered.
- **AI personalities:** each difficulty has its own commentator. Easy is *Arif Shenoy* (cheerful and encouraging), Normal is *Austin Mead* (a good sport) and Hard is *Chris Degnan* (a confident champion). Profile photos go in `img/personas/` and are set with each persona's `photo` field in `js/personas.js`; without one, initials are shown.
- **Sound and animation:** a splash for a miss, an explosion and screen shake for a hit, and a sinking animation when a ship goes down. Sounds are generated in the browser (no audio files). Use **Sound on/off** to mute. Animations are reduced if your device asks for reduced motion.
- **Movable fleet:** once per game, during the battle, click **Move a ship**, pick one of your ships that hasn't been hit, then click its new spot (press **R** to rotate, **Esc** to cancel). Moving uses up your turn, and the new spot can't include a square the AI has already fired at.
- **End-of-game stats:** shots, hits, accuracy, longest hit streak, ships sunk, the turn each ship sank, and a heat map of where the AI fired (or where you fired).

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
js/themes.js      theme names, labels and ship names
js/personas.js    AI personalities and their lines
js/sound.js       sound effects (Web Audio API)
e2e/              browser tests (Playwright)
tests/            automated tests (Node's built-in test runner)
BUGS.md           bugs found during testing and how they were fixed
```

No build step or dependencies: it's plain HTML, CSS and JavaScript.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine + AI tests (Node 18+)
npm i --no-save playwright && npx playwright install chromium
npm run test:e2e              # browser tests (needs the server above running)
```
