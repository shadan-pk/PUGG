import { BaseGame } from './base-game.js';

export class ConnectFourGame extends BaseGame {
  constructor() {
    super('connect-four');
  }

  async tryMatchPlayers() {
    const queueLength = await this.getQueueLength();
    if (queueLength >= this.getMinPlayers()) {
      const players = [];
      while (players.length < this.getMinPlayers()) {
        const playerData = await this.popFromQueue();
        if (!playerData) break;
        players.push(JSON.parse(playerData));
      }
      if (players.length === this.getMinPlayers()) {
        return await this.createMatch(players);
      } else {
        for (const player of players) await this.addToQueue(player);
      }
    }
    return { matched: false };
  }

  createInitialGameState(players) {
    return {
      board: Array(6).fill(null).map(() => Array(7).fill(null)),
      currentPlayer: 0,
      players: players,
      finished: false,
      winner: null,
      isDraw: false
    };
  }

  validateMove(gameState, userId, moveData) {
    const { column } = moveData;
    
    if (gameState.finished) {
      return { valid: false, error: "Game is finished" };
    }

    const currentPlayerIndex = gameState.players.findIndex(p => p.userId === userId);
    if (currentPlayerIndex !== gameState.currentPlayer) {
      return { valid: false, error: "Not your turn" };
    }

    if (column < 0 || column >= 7) {
      return { valid: false, error: "Invalid column" };
    }

    if (gameState.board[0][column] !== null) {
      return { valid: false, error: "Column is full" };
    }

    return { valid: true };
  }

  makeMove(gameState, userId, moveData) {
    const { column } = moveData;
    const newGameState = JSON.parse(JSON.stringify(gameState));
    
    // Find the lowest empty row in the column
    for (let row = 5; row >= 0; row--) {
      if (newGameState.board[row][column] === null) {
        newGameState.board[row][column] = newGameState.currentPlayer;
        break;
      }
    }

    // Check for win or draw
    const gameEnd = this.checkGameEnd(newGameState);
    if (gameEnd.finished) {
      newGameState.finished = true;
      newGameState.winner = gameEnd.winner;
      newGameState.isDraw = gameEnd.isDraw;
    } else {
      // Switch to next player
      newGameState.currentPlayer = (newGameState.currentPlayer + 1) % 2;
    }

    return newGameState;
  }

  checkGameEnd(gameState) {
    const { board } = gameState;
    
    // Check for win
    const winner = this.checkWinner(board);
    if (winner !== null) {
      return { finished: true, winner: gameState.players[winner], isDraw: false };
    }

    // Check for draw (board is full)
    const isDraw = board[0].every(cell => cell !== null);
    if (isDraw) {
      return { finished: true, winner: null, isDraw: true };
    }

    return { finished: false };
  }

  checkWinner(board) {
    const rows = 6;
    const cols = 7;

    // Check horizontal
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols - 3; col++) {
        const player = board[row][col];
        if (player !== null && 
            player === board[row][col + 1] && 
            player === board[row][col + 2] && 
            player === board[row][col + 3]) {
          return player;
        }
      }
    }

    // Check vertical
    for (let row = 0; row < rows - 3; row++) {
      for (let col = 0; col < cols; col++) {
        const player = board[row][col];
        if (player !== null && 
            player === board[row + 1][col] && 
            player === board[row + 2][col] && 
            player === board[row + 3][col]) {
          return player;
        }
      }
    }

    // Check diagonal (top-left to bottom-right)
    for (let row = 0; row < rows - 3; row++) {
      for (let col = 0; col < cols - 3; col++) {
        const player = board[row][col];
        if (player !== null && 
            player === board[row + 1][col + 1] && 
            player === board[row + 2][col + 2] && 
            player === board[row + 3][col + 3]) {
          return player;
        }
      }
    }

    // Check diagonal (top-right to bottom-left)
    for (let row = 0; row < rows - 3; row++) {
      for (let col = 3; col < cols; col++) {
        const player = board[row][col];
        if (player !== null && 
            player === board[row + 1][col - 1] && 
            player === board[row + 2][col - 2] && 
            player === board[row + 3][col - 3]) {
          return player;
        }
      }
    }

    return null;
  }

  getGameDisplayName() { return "Connect Four"; }
  getMinPlayers() { return 2; }
  getMaxPlayers() { return 2; }
}

const game = new ConnectFourGame();
export const handleMatchmaking = (userId, username) => game.handleMatchmaking(userId, username);
export const cancelMatchmaking = (userId) => game.cancelMatchmaking(userId);