/* Chandy Crave - Match 3 game */

/**
 * Game configuration constants
 */
const BOARD_SIZE = 8;
const INITIAL_MOVES = 24;
const SCORE_PER_TILE = 10;
const CASCADE_BONUS_PER_STEP = 0.25; // +25% per cascade step beyond the first
const HAMMER_STARTING_COUNT = 3;
const HINT_HIGHLIGHT_MS = 1200;
const SWIPE_THRESHOLD_PX = 18;
const LEVEL_BASE_TARGET = 600;
const LEVEL_TARGET_STEP = 350;

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
  // extended state
  hammerCount: HAMMER_STARTING_COUNT,
  isHammerMode: false,
  history: [], // stack of previous states for undo
  soundOn: false,
  touchStart: null, // {row,col,x,y}
  level: 1,
  targetScore: LEVEL_BASE_TARGET,
  lastSwap: null, // { a, b } for the last swap that created a special
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
// new controls
const hintBtn = document.getElementById("hintBtn");
const hammerBtn = document.getElementById("hammerBtn");
const hammerCountEl = document.getElementById("hammerCount");
const undoBtn = document.getElementById("undoBtn");
const soundBtn = document.getElementById("soundBtn");
// new stats and overlays
const levelEl = document.getElementById("level");
const targetEl = document.getElementById("target");
const levelOverlayEl = document.getElementById("levelOverlay");
const nextLevelBtn = document.getElementById("nextLevelBtn");

/** Utilities */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
}
function playBeep(type = "ok") {
  if (!state.soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  const now = audioCtx.currentTime;
  const freq = type === "ok" ? 680 : type === "bad" ? 220 : type === "clear" ? 520 : 440;
  o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(now);
  o.stop(now + 0.2);
}

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
  if (levelEl) levelEl.textContent = String(state.level);
  if (targetEl) targetEl.textContent = String(state.targetScore);
  if (hammerCountEl) hammerCountEl.textContent = `x${state.hammerCount}`;
  if (soundBtn) soundBtn.textContent = `Sound: ${state.soundOn ? 'On' : 'Off'}`;
  if (soundBtn) soundBtn.setAttribute('aria-pressed', String(state.soundOn));
}

function deepCloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function pushHistory() {
  // Keep last few states to bound memory
  const snapshot = {
    grid: deepCloneGrid(state.grid),
    movesRemaining: state.movesRemaining,
    score: state.score,
    hammerCount: state.hammerCount,
  };
  state.history.push(snapshot);
  if (state.history.length > 10) state.history.shift();
}

function popHistory() {
  return state.history.pop() || null;
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

// Special pieces encoding: store objects in grid instead of plain index when special
// { type: 'tile', kind: number } regular
// { type: 'row'|'col'|'bomb', kind: number } specials

function isObjectTile(cell) {
  return cell && typeof cell === 'object';
}

function getKind(cell) {
  if (cell === null) return null;
  if (isObjectTile(cell)) return cell.kind;
  return cell;
}

function setNormalTile(row, col, kind) {
  state.grid[row][col] = { type: 'tile', kind };
}

function setSpecial(row, col, specialType, kind) {
  state.grid[row][col] = { type: specialType, kind };
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = tileAt(row, col);
      const tileEl = document.createElement("button");
      tileEl.className = "tile";
      tileEl.setAttribute("role", "gridcell");
      tileEl.setAttribute("aria-label", `Tile ${row + 1}, ${col + 1}`);
      tileEl.dataset.row = String(row);
      tileEl.dataset.col = String(col);
      const kind = getKind(cell);
      const emoji = kind !== null ? TILE_EMOJIS[kind] : "";
      tileEl.textContent = emoji;
      if (isObjectTile(cell) && cell.type !== 'tile') {
        // add a subtle marker for specials
        tileEl.textContent += cell.type === 'row' ? '⟷' : cell.type === 'col' ? '↕' : '💥';
      }
      tileEl.addEventListener("click", onTileClick);
      if (state.selected && state.selected.row === row && state.selected.col === col) {
        tileEl.classList.add("selected");
      }
      boardEl.appendChild(tileEl);
    }
  }
}

function randomTileIndex() {
  return Math.floor(Math.random() * TILE_EMOJIS.length);
}

function generateInitialBoard() {
  state.grid = createEmptyGrid();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      let tile;
      do {
        tile = randomTileIndex();
        setNormalTile(row, col, tile);
      } while (createsImmediateMatch(row, col));
    }
  }

  let safety = 0;
  while (!hasAnyValidMove() && safety < 20) {
    shuffleBoard();
    safety++;
  }
}

function createsImmediateMatch(row, col) {
  const current = getKind(tileAt(row, col));
  // Check left and left-left
  if (inBounds(row, col - 1) && inBounds(row, col - 2)) {
    if (getKind(tileAt(row, col - 1)) === current && getKind(tileAt(row, col - 2)) === current) return true;
  }
  // Check up and up-up
  if (inBounds(row - 1, col) && inBounds(row - 2, col)) {
    if (getKind(tileAt(row - 1, col)) === current && getKind(tileAt(row - 2, col)) === current) return true;
  }
  return false;
}

function onTileClick(event) {
  if (state.isResolving) return;
  const target = event.currentTarget;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const current = { row, col };

  if (state.isHammerMode) {
    useHammerOn(current);
    return;
  }

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

async function useHammerOn(cell) {
  if (state.hammerCount <= 0) {
    statusEl.textContent = "No hammers left";
    await sleep(300);
    statusEl.textContent = "";
    state.isHammerMode = false;
    boardEl.classList.remove("hammer-mode");
    return;
  }
  state.isResolving = true;
  state.isHammerMode = false;
  boardEl.classList.remove("hammer-mode");

  pushHistory();

  // Clear the chosen tile
  setTile(cell.row, cell.col, null);
  renderBoard();
  playBeep("clear");
  await sleep(120);

  // Apply gravity and refill and resolve any resulting matches
  applyGravity();
  refillBoard();
  renderBoard();
  await sleep(100);

  let matched = findAllMatches();
  while (matched.size > 0) {
    await animateClears(matched);
    applyClears(matched);
    const gained = computeScoreGain(matched.size, 1);
    state.score += gained;
    if (state.score > getBestScore()) setBestScore(state.score);
    updateHud();
    applyGravity();
    refillBoard();
    renderBoard();
    await sleep(100);
    matched = findAllMatches();
  }

  state.hammerCount -= 1;
  updateHud();
  state.isResolving = false;
}

async function attemptSwap(a, b) {
  if (state.isResolving) return;
  state.isResolving = true;

  // snapshot before mutating for undo
  pushHistory();
  state.lastSwap = { a, b };

  swapInGrid(a, b);
  renderBoard();

  const matched = findAllMatches();
  if (matched.size === 0) {
    await sleep(180);
    swapInGrid(a, b);
    state.history.pop();
    playBeep("bad");
    state.selected = null;
    state.lastSwap = null;
    state.isResolving = false;
    renderBoard();
    return;
  }

  state.movesRemaining = Math.max(0, state.movesRemaining - 1);
  state.selected = null;
  updateHud();
  playBeep("ok");
  await resolveMatchesCascade(matched);

  state.lastSwap = null;

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
  const matched = new Set();
  const lines = [];

  // Horizontal
  for (let row = 0; row < BOARD_SIZE; row++) {
    let runStart = 0;
    for (let col = 1; col <= BOARD_SIZE; col++) {
      const current = col < BOARD_SIZE ? getKind(tileAt(row, col)) : null;
      const prev = getKind(tileAt(row, col - 1));
      if (col < BOARD_SIZE && current === prev) continue;
      const runLength = col - runStart;
      if (prev !== null && runLength >= 3) {
        for (let c = runStart; c < col; c++) matched.add(`${row},${c}`);
        lines.push({ dir: 'row', row, start: runStart, end: col - 1, length: runLength, kind: prev });
      }
      runStart = col;
    }
  }

  // Vertical
  for (let col = 0; col < BOARD_SIZE; col++) {
    let runStart = 0;
    for (let row = 1; row <= BOARD_SIZE; row++) {
      const current = row < BOARD_SIZE ? getKind(tileAt(row, col)) : null;
      const prev = getKind(tileAt(row - 1, col));
      if (row < BOARD_SIZE && current === prev) continue;
      const runLength = row - runStart;
      if (prev !== null && runLength >= 3) {
        for (let r = runStart; r < row; r++) matched.add(`${r},${col}`);
        lines.push({ dir: 'col', col, start: runStart, end: row - 1, length: runLength, kind: prev });
      }
      runStart = row;
    }
  }

  // Create specials for 4 or 5 matches: place at the last swapped position if known; otherwise at an end
  if (state.lastSwap) {
    for (const line of lines) {
      if (line.length === 4) {
        const { a, b } = state.lastSwap;
        const target = choosePlacementForLine(line, a, b);
        if (target) {
          matched.delete(`${target.row},${target.col}`); // will replace with special, not clear it
          setSpecial(target.row, target.col, line.dir === 'row' ? 'row' : 'col', line.kind);
        }
      } else if (line.length >= 5) {
        const { a, b } = state.lastSwap;
        const target = choosePlacementForLine(line, a, b);
        if (target) {
          matched.delete(`${target.row},${target.col}`);
          setSpecial(target.row, target.col, 'bomb', line.kind);
        }
      }
    }
  }

  return matched;
}

function choosePlacementForLine(line, a, b) {
  // choose the cell from the line that matches either swap endpoint; else fallback
  const cells = [];
  if (line.dir === 'row') {
    for (let c = line.start; c <= line.end; c++) cells.push({ row: line.row, col: c });
  } else {
    for (let r = line.start; r <= line.end; r++) cells.push({ row: r, col: line.col });
  }
  for (const cell of cells) {
    if ((cell.row === a.row && cell.col === a.col) || (cell.row === b.row && cell.col === b.col)) return cell;
  }
  return cells[0];
}

async function resolveMatchesCascade(initialMatched) {
  let matched = initialMatched;
  state.cascadeDepth = 0;

  while (matched.size > 0) {
    state.cascadeDepth++;

    await animateClears(matched);
    // Expand matched with special effects
    expandSpecialEffects(matched);
    applyClears(matched);

    const gained = computeScoreGain(matched.size, state.cascadeDepth);
    state.score += gained;
    if (state.score > getBestScore()) setBestScore(state.score);
    updateHud();

    applyGravity();
    refillBoard();
    renderBoard();

    await sleep(120);

    matched = findAllMatches();
    playBeep("clear");

    // Level progression
    if (state.score >= state.targetScore) {
      await levelComplete();
      break;
    }
  }

  statusEl.textContent = state.cascadeDepth > 1 ? `Cascade x${state.cascadeDepth}!` : "";
}

function expandSpecialEffects(matched) {
  const additions = new Set();
  for (const key of [...matched]) {
    const [r, c] = key.split(',').map(Number);
    const cell = tileAt(r, c);
    if (isObjectTile(cell) && cell.type !== 'tile') {
      if (cell.type === 'row') {
        for (let cc = 0; cc < BOARD_SIZE; cc++) additions.add(`${r},${cc}`);
      } else if (cell.type === 'col') {
        for (let rr = 0; rr < BOARD_SIZE; rr++) additions.add(`${rr},${c}`);
      } else if (cell.type === 'bomb') {
        for (let rr = r - 1; rr <= r + 1; rr++) {
          for (let cc = c - 1; cc <= c + 1; cc++) {
            if (inBounds(rr, cc)) additions.add(`${rr},${cc}`);
          }
        }
      }
    }
  }
  for (const add of additions) matched.add(add);
}

async function levelComplete() {
  levelOverlayEl.classList.remove('hidden');
}

function startNextLevel() {
  levelOverlayEl.classList.add('hidden');
  state.level += 1;
  state.targetScore = LEVEL_BASE_TARGET + (state.level - 1) * LEVEL_TARGET_STEP;
  state.movesRemaining = INITIAL_MOVES;
  state.hammerCount = HAMMER_STARTING_COUNT;
  state.selected = null;
  state.history = [];
  generateInitialBoard();
  updateHud();
  renderBoard();
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
  state.hammerCount = HAMMER_STARTING_COUNT;
  state.isHammerMode = false;
  state.history = [];
  state.level = 1;
  state.targetScore = LEVEL_BASE_TARGET;
  boardEl.classList.remove('hammer-mode');
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
  // new control handlers
  hintBtn.addEventListener('click', () => { showHint(); });
  hammerBtn.addEventListener('click', () => {
    if (state.isResolving) return;
    if (state.hammerCount <= 0) return;
    state.isHammerMode = !state.isHammerMode;
    boardEl.classList.toggle('hammer-mode', state.isHammerMode);
    statusEl.textContent = state.isHammerMode ? 'Hammer: tap a tile to break' : '';
  });
  undoBtn.addEventListener('click', () => {
    const snapshot = popHistory();
    if (!snapshot || state.isResolving) return;
    state.grid = deepCloneGrid(snapshot.grid);
    state.movesRemaining = snapshot.movesRemaining;
    state.score = snapshot.score;
    state.hammerCount = snapshot.hammerCount ?? state.hammerCount;
    renderBoard();
    updateHud();
  });
  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    if (state.soundOn) playBeep('ok');
    updateHud();
  });
  nextLevelBtn.addEventListener('click', startNextLevel);

  // touch swipe
  boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
  boardEl.addEventListener('touchmove', onTouchMove, { passive: true });
  boardEl.addEventListener('touchend', onTouchEnd, { passive: true });
}

function findHintMove() {
  // Return a pair of coordinates that forms a match if swapped, or null
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
        if (matched.size > 0) return [here, n];
      }
    }
  }
  return null;
}

async function showHint() {
  const move = findHintMove();
  if (!move) {
    statusEl.textContent = "No hints available";
    await sleep(400);
    statusEl.textContent = "";
    return;
  }
  const [a, b] = move;
  const aEl = findTileElement(a.row, a.col);
  const bEl = findTileElement(b.row, b.col);
  if (!aEl || !bEl) return;
  aEl.classList.add("hint");
  bEl.classList.add("hint");
  await sleep(HINT_HIGHLIGHT_MS);
  aEl.classList.remove("hint");
  bEl.classList.remove("hint");
}

function onTouchStart(e) {
  if (state.isResolving) return;
  const target = e.target.closest('.tile');
  if (!target) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const touch = e.touches[0];
  state.touchStart = { row, col, x: touch.clientX, y: touch.clientY };
}

function onTouchMove(e) {
  if (!state.touchStart || state.isResolving) return;
  const touch = e.touches[0];
  const dx = touch.clientX - state.touchStart.x;
  const dy = touch.clientY - state.touchStart.y;
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
  let targetCell = null;
  if (Math.abs(dx) > Math.abs(dy)) {
    // horizontal
    if (dx > 0) targetCell = { row: state.touchStart.row, col: state.touchStart.col + 1 };
    else targetCell = { row: state.touchStart.row, col: state.touchStart.col - 1 };
  } else {
    // vertical
    if (dy > 0) targetCell = { row: state.touchStart.row + 1, col: state.touchStart.col };
    else targetCell = { row: state.touchStart.row - 1, col: state.touchStart.col };
  }
  if (targetCell && inBounds(targetCell.row, targetCell.col)) {
    const from = { row: state.touchStart.row, col: state.touchStart.col };
    state.touchStart = null;
    attemptSwap(from, targetCell);
  }
}

function onTouchEnd() {
  state.touchStart = null;
}

// Boot
wireUi();
resetGame();