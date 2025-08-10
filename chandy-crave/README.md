# Chandy Crave

A simple, self-contained match-3 web game inspired by Candy Crush. Swap adjacent tiles to match 3+ of the same candy, score points, and trigger cascades.

## Features
- Core match-3 mechanics: swap, match, clear, gravity, refill
- Cascading clears with score multipliers
- Moves counter, score, and best score (saved in localStorage)
- Shuffle button and automatic reshuffle when no moves exist
- Simple animations and responsive UI
- Hint button to highlight a possible move
- Hammer power-up to break any tile (x3 per game)
- Undo (1-step history per move; up to 10 states)
- Touch swipe support for mobile
- Optional sound effects (Web Audio)

## Run
Open `index.html` in a modern browser.

If you prefer a local server:

```bash
# from the project directory
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

## Controls
- Click a tile to select, then click an adjacent tile (or swipe) to swap.
- Only swaps that create a match are allowed, and consume one move.
- Hint: shows a suggested swap.
- Hammer: toggle, then tap a tile to break it (does not consume a move).
- Undo: revert to the state before your last valid action.
- Sound: toggle simple beeps.
- When moves reach 0, the game ends. Click "Play Again" to restart.

## Customize
- Change board size, moves, and scoring in `main.js` constants.
- Swap the emoji set in `main.js` for your own icons.