# Match-3 (Candy Crush-like)

A small vanilla JavaScript match-3 game with an 8×8 grid, swapping, match detection, cascades, scoring, move limit, and restart.

## Features

- 8×8 responsive board
- Click or drag to swap adjacent candies
- Only swaps that create a match are accepted
- Match-3 or more in rows/columns
- Cascading clears with basic animations
- Score with chain multiplier and move limit (30)
- Local best score storage
- Restart and game-over overlay

## Run locally

- Option 1: Open `index.html` directly in your browser
- Option 2: Serve with a simple HTTP server

```bash
cd /workspace/candy-crush
python3 -m http.server 5173
# Open http://localhost:5173 in your browser
```

## Customize

- Adjust board size or candy types in `main.js` via `GRID_SIZE` and `CANDY_TYPES`
- Tweak visuals in `style.css`
