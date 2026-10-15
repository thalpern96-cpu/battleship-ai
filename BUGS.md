# Bug report: Battleship vs AI

How I tested the game:

- **Automated engine tests** (`npm test`, 11 tests). These check ship placement rules, hit/miss/sunk detection and win detection, and they simulate more than 2,000 complete AI games to confirm the AI never fires at the same square twice, never fires off the board, and always finishes a game.
- **Automated browser tests** (`e2e/ui-check.js`, about 30 checks run in a real Chromium browser). They place ships by hand, rotate and move ships, use random placement, try to fire twice during the AI's turn, restart while the AI is mid-turn, play a full game to the end, and check the layout on a phone-sized screen.
- **Screenshots**: I looked at the game screen in the middle of a game, at the game-over screen, and on mobile.

## Bugs found and fixed

| # | Bug | Cause | Fix |
|---|-----|-------|-----|
| 1 | **Boards looked faded/greyed out.** During a battle your whole board was dimmed, and squares you had already fired at on the enemy board were darker than intended, which made hits and misses hard to read. | Each grid square is a `<button>`. A general style meant for disabled buttons (`button:disabled { opacity: .45 }`) also applied to grid squares, because squares are disabled when they can't be clicked. | That style now applies only to control buttons (`button:not(.cell)`), not to grid squares. A browser test checks the board is fully opaque during battle. |
| 2 | **Placed ships seemed to vanish under the mouse.** Hovering over one of your placed ships turned it water-blue. On phones the square stayed blue after you tapped it. | A `.cell:hover` rule was more specific than the `.cell.ship` colour, so the hover colour won. | Removed that rule. The hover highlight now only appears on enemy squares you can still fire at. A browser test checks that a hovered ship square stays grey. |
| 3 | **The battle log was numbered backwards.** The newest event was shown at the top but numbered "1", and every older event got a higher number. | New entries are added to the top of a normal numbered list (`<ol>`), so the numbers counted the wrong way. | Made it a reversed list (`<ol reversed>`), so the newest entry has the highest number. A browser test checks this. |
| 4 | **"Easy" AI was practically impossible to lose to.** It fired completely at random and needed about 95 of the 100 squares to sink a fleet, so a game against it was no contest. | Pure random targeting that ignored its own hits. | Easy still fires randomly, but 60% of the time it follows up a hit by firing next to it. It now needs about 65 shots on average. Normal needs about 51 and Hard about 46, and a test checks that each harder level beats the easier one. |

## Potential bugs checked and confirmed not present

These are common Battleship bugs. Tests confirm each one is handled:

- Firing a second shot (double-click) while the AI is taking its turn: blocked.
- Clicking "New game" while the AI is mid-turn: the pending AI shot is cancelled, so it doesn't land on the new board.
- Firing at a square you already fired at, or firing before the battle starts: ignored.
- Ships placed off the edge of the board or on top of each other: rejected. The red preview shows only the squares that are on the board.
- The two 3-square ships (Cruiser and Submarine): the AI keeps track of them separately.
- The AI does not cheat. It only learns hit, miss or sunk, the same as you.
- Saved win/loss stats: if the browser blocks storage (for example Safari private mode), the game still works.
- Phone-sized screens: no sideways scrolling, and tapping places ships.
