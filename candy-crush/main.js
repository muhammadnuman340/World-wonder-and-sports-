/* Match-3 (Candy Crush-like) — Vanilla JS implementation */
(() => {
  const GRID_SIZE = 8;
  const CANDY_TYPES = 6; // 0..5
  const STARTING_MOVES = 30;

  /** @type {number[]} */
  let board = [];
  let score = 0;
  let moves = STARTING_MOVES;
  let best = Number.parseInt(localStorage.getItem('bestScore') || '0', 10) || 0;
  let isResolving = false;

  /** @type {number|null} */
  let selectedIndex = null;

  const $board = document.getElementById('board');
  const $score = document.getElementById('score');
  const $moves = document.getElementById('moves');
  const $best = document.getElementById('best');
  const $restartBtn = document.getElementById('restartBtn');

  const $overlay = document.getElementById('overlay');
  const $overlayRestart = document.getElementById('overlayRestart');
  const $finalScore = document.getElementById('finalScore');
  const $finalBest = document.getElementById('finalBest');

  function updateHud() {
    $score.textContent = String(score);
    $moves.textContent = String(moves);
    $best.textContent = String(best);
  }

  function indexOf(row, col) {
    return row * GRID_SIZE + col;
  }

  function inBounds(row, col) {
    return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
  }

  function neighbors(index) {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    const result = [];
    if (inBounds(row - 1, col)) result.push(indexOf(row - 1, col));
    if (inBounds(row + 1, col)) result.push(indexOf(row + 1, col));
    if (inBounds(row, col - 1)) result.push(indexOf(row, col - 1));
    if (inBounds(row, col + 1)) result.push(indexOf(row, col + 1));
    return result;
  }

  function areAdjacent(a, b) {
    const ra = Math.floor(a / GRID_SIZE);
    const ca = a % GRID_SIZE;
    const rb = Math.floor(b / GRID_SIZE);
    const cb = b % GRID_SIZE;
    return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
  }

  function randomCandy() {
    return Math.floor(Math.random() * CANDY_TYPES);
  }

  function createInitialBoard() {
    board = new Array(GRID_SIZE * GRID_SIZE).fill(0);
    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        let cand;
        do {
          cand = randomCandy();
        } while (wouldCreateMatchAt(r, c, cand));
        board[indexOf(r, c)] = cand;
      }
    }
  }

  function wouldCreateMatchAt(row, col, type) {
    // Check left two
    if (col >= 2) {
      const a = board[indexOf(row, col - 1)];
      const b = board[indexOf(row, col - 2)];
      if (a === type && b === type) return true;
    }
    // Check up two
    if (row >= 2) {
      const a = board[indexOf(row - 1, col)];
      const b = board[indexOf(row - 2, col)];
      if (a === type && b === type) return true;
    }
    return false;
  }

  function renderBoard() {
    $board.innerHTML = '';
    $board.style.setProperty('--grid-size', String(GRID_SIZE));
    $board.setAttribute('aria-rowcount', String(GRID_SIZE));
    $board.setAttribute('aria-colcount', String(GRID_SIZE));

    for (let i = 0; i < board.length; i += 1) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      tile.dataset.index = String(i);
      const type = board[i];
      tile.dataset.type = String(type);
      if (selectedIndex === i) tile.classList.add('selected');
      tile.addEventListener('click', onTileClick);
      tile.addEventListener('pointerdown', onPointerDown);
      tile.addEventListener('dragstart', (e) => e.preventDefault());
      $board.appendChild(tile);
    }
  }

  function setTileType(index, type) {
    board[index] = type;
    const el = $board.querySelector(`[data-index="${index}"]`);
    if (el) el.setAttribute('data-type', String(type));
  }

  function setTileClass(index, className, add) {
    const el = $board.querySelector(`[data-index="${index}"]`);
    if (el) el.classList.toggle(className, add);
  }

  function swap(a, b) {
    const t = board[a];
    board[a] = board[b];
    board[b] = t;
  }

  function findMatches() {
    /** @type {Set<number>} */
    const matched = new Set();
    // Horizontal
    for (let r = 0; r < GRID_SIZE; r += 1) {
      let runType = null;
      let runStart = 0;
      let runLength = 0;
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const idx = indexOf(r, c);
        const type = board[idx];
        if (type === runType) {
          runLength += 1;
        } else {
          if (runType !== null && runLength >= 3) {
            for (let k = 0; k < runLength; k += 1) matched.add(indexOf(r, runStart + k));
          }
          runType = type;
          runStart = c;
          runLength = 1;
        }
      }
      if (runType !== null && runLength >= 3) {
        for (let k = 0; k < runLength; k += 1) matched.add(indexOf(r, runStart + k));
      }
    }
    // Vertical
    for (let c = 0; c < GRID_SIZE; c += 1) {
      let runType = null;
      let runStart = 0;
      let runLength = 0;
      for (let r = 0; r < GRID_SIZE; r += 1) {
        const idx = indexOf(r, c);
        const type = board[idx];
        if (type === runType) {
          runLength += 1;
        } else {
          if (runType !== null && runLength >= 3) {
            for (let k = 0; k < runLength; k += 1) matched.add(indexOf(runStart + k, c));
          }
          runType = type;
          runStart = r;
          runLength = 1;
        }
      }
      if (runType !== null && runLength >= 3) {
        for (let k = 0; k < runLength; k += 1) matched.add(indexOf(runStart + k, c));
      }
    }
    return matched;
  }

  function animateClears(indices) {
    indices.forEach((idx) => setTileClass(idx, 'clearing', true));
  }

  function clearMatches(indices) {
    indices.forEach((idx) => {
      setTileClass(idx, 'clearing', false);
      setTileType(idx, null);
    });
  }

  function collapseAndRefill() {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const colValues = [];
      for (let r = GRID_SIZE - 1; r >= 0; r -= 1) {
        const idx = indexOf(r, c);
        const t = board[idx];
        if (t !== null && t !== undefined) {
          colValues.push(t);
        }
      }
      // Fill from bottom
      for (let r = GRID_SIZE - 1; r >= 0; r -= 1) {
        const idx = indexOf(r, c);
        const next = colValues.shift();
        if (next !== undefined) {
          setTileType(idx, next);
        } else {
          const newType = randomCandy();
          setTileType(idx, newType);
          setTileClass(idx, 'spawn', true);
          setTimeout(() => setTileClass(idx, 'spawn', false), 180);
        }
      }
    }
  }

  async function resolveBoardChain(initial = false) {
    if (isResolving) return false;
    isResolving = true;
    let chain = 0;
    let anyCleared = false;
    while (true) {
      const matches = findMatches();
      if (matches.size === 0) break;
      anyCleared = true;
      chain += 1;
      animateClears(matches);
      await delay(140);
      clearMatches(matches);
      // Score: base 10 per candy, slight chain multiplier
      const gained = matches.size * 10 * chain;
      score += gained;
      updateHud();
      await delay(80);
      collapseAndRefill();
      await delay(120);
    }
    isResolving = false;
    if (!initial) {
      // After a user move, save best if improved
      if (score > best) {
        best = score;
        localStorage.setItem('bestScore', String(best));
        updateHud();
      }
      if (moves <= 0) {
        openOverlay();
      }
    }
    return anyCleared;
  }

  function delay(ms) { return new Promise((res) => setTimeout(res, ms)); }

  async function attemptSwap(a, b) {
    if (isResolving || a === b || !areAdjacent(a, b)) return;

    swap(a, b);
    // Optimistically update DOM attributes for those two tiles for responsiveness
    setTileType(a, board[a]);
    setTileType(b, board[b]);

    const matches = findMatches();
    if (matches.size > 0) {
      // Count as a move only on successful match-producing swap
      moves = Math.max(0, moves - 1);
      updateHud();
      selectedIndex = null;
      await resolveBoardChain(false);
    } else {
      // Revert swap
      await delay(80);
      swap(a, b);
      setTileType(a, board[a]);
      setTileType(b, board[b]);
    }
  }

  function onTileClick(e) {
    if (isResolving) return;
    const target = e.currentTarget;
    const idx = Number.parseInt(target.dataset.index, 10);

    if (selectedIndex === null) {
      selectedIndex = idx;
      setTileClass(selectedIndex, 'selected', true);
    } else if (selectedIndex === idx) {
      setTileClass(selectedIndex, 'selected', false);
      selectedIndex = null;
    } else {
      const prev = selectedIndex;
      setTileClass(prev, 'selected', false);
      selectedIndex = null;
      if (areAdjacent(prev, idx)) {
        attemptSwap(prev, idx);
      } else {
        // Select new
        selectedIndex = idx;
        setTileClass(selectedIndex, 'selected', true);
      }
    }
  }

  function onPointerDown(e) {
    if (isResolving) return;
    const startTarget = e.currentTarget;
    const startIdx = Number.parseInt(startTarget.dataset.index, 10);
    const rect = $board.getBoundingClientRect();

    function onMove(ev) {
      const p = ev.touches ? ev.touches[0] : ev;
      const x = p.clientX - rect.left;
      const y = p.clientY - rect.top;
      const cellSize = startTarget.offsetWidth + getGapPx();
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      if (!inBounds(row, col)) return;
      const idx = indexOf(row, col);
      if (idx !== startIdx && areAdjacent(startIdx, idx)) {
        cleanup();
        attemptSwap(startIdx, idx);
      }
    }

    function getGapPx() {
      const styles = getComputedStyle($board);
      const gap = styles.gap || styles.gridGap || '0px';
      return Number.parseFloat(gap);
    }

    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', cleanup);
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', cleanup, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', cleanup, { passive: true });
  }

  function openOverlay() {
    $finalScore.textContent = String(score);
    $finalBest.textContent = String(best);
    $overlay.classList.remove('hidden');
  }

  function closeOverlay() {
    $overlay.classList.add('hidden');
  }

  function restart() {
    score = 0;
    moves = STARTING_MOVES;
    selectedIndex = null;
    updateHud();
    createInitialBoard();
    renderBoard();
    resolveBoardChain(true);
  }

  function init() {
    updateHud();
    createInitialBoard();
    renderBoard();
    resolveBoardChain(true);

    $restartBtn.addEventListener('click', () => {
      closeOverlay();
      restart();
    });

    $overlayRestart.addEventListener('click', () => {
      closeOverlay();
      restart();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();