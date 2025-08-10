/* Chandy Crave - Match 3 game */

/**
 * Game configuration constants
 */
const BOARD_SIZE = 8;
const INITIAL_MOVES = 24;
const SCORE_PER_TILE = 10;
const CASCADE_BONUS_PER_STEP = 0.25; // +25% per cascade step beyond the first

// Emoji tile set - can be swapped for images if desired
const TILE_EMOJIS = ["🍒", "🍋", "🍇", "🍏", "🍊", "🍬"];

/**
 * Global game state
 */
const state = {
  grid: [], // 2D array of tile indices
  isResolving: false,
  selected: null, // { row, col }
  movesRemaining: INITIAL_MOVES,
  score: 0,
  cascadeDepth: 0,
};

/** DOM elements */
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const movesEl = document.getElementById("moves");
const statusEl = document.getElementById("status");
const overlayEl = document.getElementById("overlay");
const finalScoreEl = document.getElementById("finalScore");
const newGameBtn = document.getElementById("newGameBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

/** Utilities */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function getBestScore() {
  const value = localStorage.getItem("chandy_best_score");
  return value ? Number(value) : 0;
}

function setBestScore(value) {
  localStorage.setItem("chandy_best_score", String(value));
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  movesEl.textContent = String(state.movesRemaining);
  bestEl.textContent = String(getBestScore());
}

function createEmptyGrid() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function areAdjacent(a, b) {
  if (!a || !b) return false;
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function randomTileIndex() {
  return Math.floor(Math.random() * TILE_EMOJIS.length);
}

function tileAt(row, col) {
  return state.grid[row][col];
}

function setTile(row, col, value) {
  state.grid[row][col] = value;
}

function renderBoard() {
  // Render the board from state
  boardEl.innerHTML = "";
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tileIndex = tileAt(row, col);
      const tileEl = document.createElement("button");
      tileEl.className = "tile";
      tileEl.setAttribute("role", "gridcell");
      tileEl.setAttribute("aria-label", `Tile ${row + 1}, ${col + 1}`);
      tileEl.dataset.row = String(row);
      tileEl.dataset.col = String(col);
      tileEl.textContent = tileIndex !== null ? TILE_EMOJIS[tileIndex] : "";
      tileEl.addEventListener("click", onTileClick);
      if (state.selected && state.selected.row === row && state.selected.col === col) {
        tileEl.classList.add("selected");
      }
      boardEl.appendChild(tileEl);
    }
  }
}

function generateInitialBoard() {
  state.grid = createEmptyGrid();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      let tile;
      do {
        tile = randomTileIndex();
        setTile(row, col, tile);
      } while (createsImmediateMatch(row, col));
    }
  }

  // Ensure at least one possible move exists; reshuffle if none
  let safety = 0;
  while (!hasAnyValidMove() && safety < 20) {
    shuffleBoard();
    safety++;
  }
}

function createsImmediateMatch(row, col) {
  const current = tileAt(row, col);
  // Check left and left-left
  if (inBounds(row, col - 1) && inBounds(row, col - 2)) {
    if (tileAt(row, col - 1) === current && tileAt(row, col - 2) === current) return true;
  }
  // Check up and up-up
  if (inBounds(row - 1, col) && inBounds(row - 2, col)) {
    if (tileAt(row - 1, col) === current && tileAt(row - 2, col) === current) return true;
  }
  return false;
}

function onTileClick(event) {
  if (state.isResolving) return;
  const target = event.currentTarget;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const current = { row, col };

  if (!state.selected) {
    state.selected = current;
  } else if (state.selected.row === row && state.selected.col === col) {
    state.selected = null;
  } else if (areAdjacent(state.selected, current)) {
    attemptSwap(state.selected, current);
  } else {
    state.selected = current; // change selection
  }
  renderBoard();
}

async function attemptSwap(a, b) {
  if (state.isResolving) return;
  state.isResolving = true;

  swapInGrid(a, b);
  renderBoard();

  const matched = findAllMatches();
  if (matched.size === 0) {
    // invalid swap; revert after a small delay
    await sleep(180);
    swapInGrid(a, b);
    state.selected = null;
    state.isResolving = false;
    renderBoard();
    return;
  }

  // Valid swap: consume a move and resolve cascades
  state.movesRemaining = Math.max(0, state.movesRemaining - 1);
  state.selected = null;
  updateHud();
  await resolveMatchesCascade(matched);

  if (state.movesRemaining === 0) {
    await endGame();
  } else if (!hasAnyValidMove()) {
    statusEl.textContent = "No moves left on board — reshuffling!";
    await sleep(400);
    shuffleBoard();
    renderBoard();
    statusEl.textContent = "";
  }

  state.isResolving = false;
}

function swapInGrid(a, b) {
  const tmp = tileAt(a.row, a.col);
  setTile(a.row, a.col, tileAt(b.row, b.col));
  setTile(b.row, b.col, tmp);
}

function findAllMatches() {
  const matched = new Set(); // store as "r,c"

  // Horizontal
  for (let row = 0; row < BOARD_SIZE; row++) {
    let runStart = 0;
    for (let col = 1; col <= BOARD_SIZE; col++) {
      const current = col < BOARD_SIZE ? tileAt(row, col) : null;
      const prev = tileAt(row, col - 1);
      if (col < BOARD_SIZE && current === prev) continue;
      const runLength = col - runStart;
      if (prev !== null && runLength >= 3) {
        for (let c = runStart; c < col; c++) matched.add(`${row},${c}`);
      }
      runStart = col;
    }
  }

  // Vertical
  for (let col = 0; col < BOARD_SIZE; col++) {
    let runStart = 0;
    for (let row = 1; row <= BOARD_SIZE; row++) {
      const current = row < BOARD_SIZE ? tileAt(row, col) : null;
      const prev = tileAt(row - 1, col);
      if (row < BOARD_SIZE && current === prev) continue;
      const runLength = row - runStart;
      if (prev !== null && runLength >= 3) {
        for (let r = runStart; r < row; r++) matched.add(`${r},${col}`);
      }
      runStart = row;
    }
  }

  return matched;
}

async function resolveMatchesCascade(initialMatched) {
  let matched = initialMatched;
  state.cascadeDepth = 0;

  while (matched.size > 0) {
    state.cascadeDepth++;

    await animateClears(matched);
    applyClears(matched);

    const gained = computeScoreGain(matched.size, state.cascadeDepth);
    state.score += gained;
    if (state.score > getBestScore()) setBestScore(state.score);
    updateHud();

    applyGravity();
    refillBoard();
    renderBoard();

    // Let tiles "settle"
    await sleep(120);

    matched = findAllMatches();
  }

  statusEl.textContent = state.cascadeDepth > 1 ? `Cascade x${state.cascadeDepth}!` : "";
}

function computeScoreGain(numTiles, cascadeDepth) {
  const base = numTiles * SCORE_PER_TILE;
  const bonusMultiplier = 1 + (cascadeDepth - 1) * CASCADE_BONUS_PER_STEP;
  return Math.round(base * bonusMultiplier);
}

async function animateClears(matched) {
  const coords = [...matched].map((key) => key.split(",").map((n) => Number(n)));
  const elements = coords.map(([r, c]) => findTileElement(r, c)).filter(Boolean);
  for (const el of elements) el.classList.add("clearing");
  await sleep(240);
}

function applyClears(matched) {
  for (const key of matched) {
    const [r, c] = key.split(",").map(Number);
    setTile(r, c, null);
  }
}

function applyGravity() {
  for (let col = 0; col < BOARD_SIZE; col++) {
    let writeRow = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= 0; row--) {
      const value = tileAt(row, col);
      if (value !== null) {
        if (row !== writeRow) {
          setTile(writeRow, col, value);
          setTile(row, col, null);
        }
        writeRow--;
      }
    }
  }
}

function refillBoard() {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (tileAt(row, col) === null) {
        setTile(row, col, randomTileIndex());
      }
    }
  }
}

function findTileElement(row, col) {
  return boardEl.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
}

function hasAnyValidMove() {
  // Try swapping each adjacent pair to see if a match is created
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const here = { row: r, col: c };
      const neighbors = [
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
      ];
      for (const n of neighbors) {
        if (!inBounds(n.row, n.col)) continue;
        swapInGrid(here, n);
        const matched = findAllMatches();
        swapInGrid(here, n);
        if (matched.size > 0) return true;
      }
    }
  }
  return false;
}

function shuffleBoard() {
  // Flatten, shuffle, then refill while avoiding immediate matches minimally
  const tiles = [];
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) tiles.push(tileAt(r, c));
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  const grid = createEmptyGrid();
  let idx = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      grid[r][c] = tiles[idx++];
    }
  }
  state.grid = grid;

  // If there are immediate matches, resolve them without consuming a move or scoring
  let safety = 0;
  while (findAllMatches().size > 0 && safety < 10) {
    applyGravity();
    refillBoard();
    safety++;
  }
}

async function endGame() {
  finalScoreEl.textContent = String(state.score);
  overlayEl.classList.remove("hidden");
}

function resetGame() {
  state.score = 0;
  state.movesRemaining = INITIAL_MOVES;
  state.selected = null;
  state.isResolving = false;
  statusEl.textContent = "";
  generateInitialBoard();
  updateHud();
  renderBoard();
}

function wireUi() {
  newGameBtn.addEventListener("click", () => {
    overlayEl.classList.add("hidden");
    resetGame();
  });
  playAgainBtn.addEventListener("click", () => {
    overlayEl.classList.add("hidden");
    resetGame();
  });
  shuffleBtn.addEventListener("click", async () => {
    if (state.isResolving) return;
    state.isResolving = true;
    statusEl.textContent = "Shuffling...";
    await sleep(200);
    shuffleBoard();
    renderBoard();
    statusEl.textContent = "";
    state.isResolving = false;
  });
}

// Boot
wireUi();
resetGame();