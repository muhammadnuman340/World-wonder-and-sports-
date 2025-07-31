class SlidingPuzzle {
    constructor() {
        this.board = [];
        this.size = 4;
        this.emptyPos = { row: 3, col: 3 };
        this.moves = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.isGameActive = false;
        
        this.initializeElements();
        this.initializeBoard();
        this.renderBoard();
        this.bindEvents();
    }
    
    initializeElements() {
        this.boardElement = document.getElementById('puzzle-board');
        this.movesElement = document.getElementById('moves');
        this.timerElement = document.getElementById('timer');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.solveBtn = document.getElementById('solve-btn');
        this.hintBtn = document.getElementById('hint-btn');
        this.winModal = document.getElementById('win-modal');
        this.playAgainBtn = document.getElementById('play-again-btn');
        this.finalMovesElement = document.getElementById('final-moves');
        this.finalTimeElement = document.getElementById('final-time');
    }
    
    initializeBoard() {
        // Create solved state
        this.board = [];
        for (let i = 0; i < this.size; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.size; j++) {
                if (i === this.size - 1 && j === this.size - 1) {
                    this.board[i][j] = 0; // Empty space
                } else {
                    this.board[i][j] = i * this.size + j + 1;
                }
            }
        }
        this.emptyPos = { row: this.size - 1, col: this.size - 1 };
    }
    
    renderBoard() {
        this.boardElement.innerHTML = '';
        
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.dataset.row = i;
                tile.dataset.col = j;
                
                if (this.board[i][j] === 0) {
                    tile.classList.add('empty');
                } else {
                    tile.textContent = this.board[i][j];
                    if (this.canMove(i, j)) {
                        tile.classList.add('movable');
                    }
                }
                
                this.boardElement.appendChild(tile);
            }
        }
    }
    
    canMove(row, col) {
        const emptyRow = this.emptyPos.row;
        const emptyCol = this.emptyPos.col;
        
        return (
            (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
            (Math.abs(col - emptyCol) === 1 && row === emptyRow)
        );
    }
    
    moveTile(row, col) {
        if (!this.canMove(row, col) || !this.isGameActive) return false;
        
        const tile = this.boardElement.children[row * this.size + col];
        const emptyTile = this.boardElement.children[this.emptyPos.row * this.size + this.emptyPos.col];
        
        // Add sliding animation
        this.addSlideAnimation(tile, row, col, this.emptyPos.row, this.emptyPos.col);
        
        // Swap values in board array
        this.board[this.emptyPos.row][this.emptyPos.col] = this.board[row][col];
        this.board[row][col] = 0;
        
        // Update empty position
        this.emptyPos = { row, col };
        
        // Update moves
        this.moves++;
        this.movesElement.textContent = this.moves;
        
        // Re-render board after animation
        setTimeout(() => {
            this.renderBoard();
            this.checkWin();
        }, 200);
        
        return true;
    }
    
    addSlideAnimation(tile, fromRow, fromCol, toRow, toCol) {
        const deltaX = (toCol - fromCol) * (tile.offsetWidth + 8);
        const deltaY = (toRow - fromRow) * (tile.offsetHeight + 8);
        
        tile.style.setProperty('--from-x', `${-deltaX}px`);
        tile.style.setProperty('--from-y', `${-deltaY}px`);
        tile.classList.add('sliding');
        
        setTimeout(() => {
            tile.classList.remove('sliding');
        }, 200);
    }
    
    shuffle() {
        // Perform random valid moves to ensure solvability
        const moves = 1000;
        
        for (let i = 0; i < moves; i++) {
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                // Swap without animation for shuffling
                this.board[this.emptyPos.row][this.emptyPos.col] = this.board[randomMove.row][randomMove.col];
                this.board[randomMove.row][randomMove.col] = 0;
                this.emptyPos = randomMove;
            }
        }
        
        this.moves = 0;
        this.movesElement.textContent = this.moves;
        this.startTimer();
        this.isGameActive = true;
        this.renderBoard();
    }
    
    getPossibleMoves() {
        const moves = [];
        const { row, col } = this.emptyPos;
        
        // Check all four directions
        const directions = [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 }
        ];
        
        for (const dir of directions) {
            if (dir.row >= 0 && dir.row < this.size && dir.col >= 0 && dir.col < this.size) {
                moves.push(dir);
            }
        }
        
        return moves;
    }
    
    checkWin() {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const expectedValue = (i === this.size - 1 && j === this.size - 1) ? 0 : i * this.size + j + 1;
                if (this.board[i][j] !== expectedValue) {
                    return false;
                }
            }
        }
        
        // Player won!
        this.isGameActive = false;
        this.stopTimer();
        this.showWinModal();
        return true;
    }
    
    showWinModal() {
        this.finalMovesElement.textContent = this.moves;
        this.finalTimeElement.textContent = this.timerElement.textContent;
        this.winModal.classList.remove('hidden');
    }
    
    hideWinModal() {
        this.winModal.classList.add('hidden');
    }
    
    startTimer() {
        this.startTime = Date.now();
        this.stopTimer(); // Clear any existing timer
        
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    resetGame() {
        this.stopTimer();
        this.initializeBoard();
        this.moves = 0;
        this.movesElement.textContent = this.moves;
        this.timerElement.textContent = '00:00';
        this.isGameActive = false;
        this.renderBoard();
        this.hideWinModal();
    }
    
    newGame() {
        this.resetGame();
        this.shuffle();
    }
    
    showHint() {
        if (!this.isGameActive) return;
        
        // Find the next best move (simple heuristic)
        const possibleMoves = this.getPossibleMoves();
        if (possibleMoves.length === 0) return;
        
        // Highlight movable tiles briefly
        const movableTiles = this.boardElement.querySelectorAll('.tile.movable');
        movableTiles.forEach(tile => {
            tile.style.transform = 'scale(1.1)';
            tile.style.filter = 'brightness(1.2)';
        });
        
        setTimeout(() => {
            movableTiles.forEach(tile => {
                tile.style.transform = '';
                tile.style.filter = '';
            });
        }, 1000);
    }
    
    autoSolve() {
        if (!this.isGameActive) return;
        
        // Simple solve demonstration - just show solution state
        this.initializeBoard();
        this.renderBoard();
        this.isGameActive = false;
        this.stopTimer();
        
        // Show notification
        const notification = document.createElement('div');
        notification.textContent = 'Puzzle solved! Click "New Game" to play again.';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 1001;
            font-weight: 600;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    bindEvents() {
        // Tile click events
        this.boardElement.addEventListener('click', (e) => {
            const tile = e.target.closest('.tile');
            if (!tile || tile.classList.contains('empty')) return;
            
            const row = parseInt(tile.dataset.row);
            const col = parseInt(tile.dataset.col);
            this.moveTile(row, col);
        });
        
        // Button events
        this.shuffleBtn.addEventListener('click', () => this.newGame());
        this.playAgainBtn.addEventListener('click', () => this.newGame());
        this.solveBtn.addEventListener('click', () => this.autoSolve());
        this.hintBtn.addEventListener('click', () => this.showHint());
        
        // Modal close on background click
        this.winModal.addEventListener('click', (e) => {
            if (e.target === this.winModal) {
                this.hideWinModal();
            }
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (!this.isGameActive) return;
            
            const { row, col } = this.emptyPos;
            let targetRow = row;
            let targetCol = col;
            
            switch (e.key) {
                case 'ArrowUp':
                    targetRow = row + 1;
                    break;
                case 'ArrowDown':
                    targetRow = row - 1;
                    break;
                case 'ArrowLeft':
                    targetCol = col + 1;
                    break;
                case 'ArrowRight':
                    targetCol = col - 1;
                    break;
                default:
                    return;
            }
            
            if (targetRow >= 0 && targetRow < this.size && targetCol >= 0 && targetCol < this.size) {
                this.moveTile(targetRow, targetCol);
                e.preventDefault();
            }
        });
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SlidingPuzzle();
});