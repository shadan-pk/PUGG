// backend/games/tictactoe.js
import { BaseGame } from './base-game.js';

export class TicTacToeGame extends BaseGame {
  constructor() {
    super('tictactoe');
  }

  // Implement abstract methods
  async tryMatchPlayers() {
    const queueLength = await this.getQueueLength();
    
    // Only try to match if we have at least 2 players
    if (queueLength >= 2) {
      // Try to match two players
      const players = [];
      while (players.length < 2) {
        const playerData = await this.popFromQueue();
        if (!playerData) break;
        players.push(JSON.parse(playerData));
      }

      console.log(`Popped ${players.length} players from queue`);

      if (players.length === 2) {
        return await this.createMatch(players);
      } else {
        // Put players back in queue if we couldn't match
        for (const player of players) {
          await this.addToQueue(player);
        }
        console.log(`Put ${players.length} players back in queue`);
      }
    }

    // Not enough players yet
    console.log(`Not enough players, waiting...`);
    return { matched: false };
  }

  createInitialGameState(players) {
    return {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      playerX: players[0].userId,
      playerO: players[1].userId,
      moves: 0
    };
  }

  validateMove(gameState, userId, moveData) {
    const { index } = moveData;
    
    // Check if cell is already occupied
    if (gameState.board[index] !== null) {
      return { valid: false, error: "Cell already occupied" };
    }
    
    // Check if game is already finished
    if (gameState.winner) {
      return { valid: false, error: "Game already finished" };
    }
    
    // Check if it's the player's turn
    const isPlayerX = gameState.playerX === userId;
    const isPlayerO = gameState.playerO === userId;
    const isCurrentPlayer = 
      (gameState.currentPlayer === "X" && isPlayerX) ||
      (gameState.currentPlayer === "O" && isPlayerO);
    
    if (!isCurrentPlayer) {
      return { valid: false, error: "Not your turn" };
    }
    
    return { valid: true };
  }

  makeMove(gameState, userId, moveData) {
    const { index } = moveData;
    
    // Make the move
    const newBoard = [...gameState.board];
    newBoard[index] = gameState.currentPlayer;
    
    // Check for winner
    const winner = this.checkWinner(newBoard);
    const isDraw = !winner && newBoard.every((cell) => cell !== null);
    
    // Update game state
    const newGameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === "X" ? "O" : "X",
      winner: winner || (isDraw ? "draw" : null),
      moves: gameState.moves + 1,
    };
    
    return newGameState;
  }

  checkGameEnd(gameState) {
    if (gameState.winner) {
      return {
        finished: true,
        winner: gameState.winner,
        isDraw: gameState.winner === "draw"
      };
    }
    return { finished: false };
  }

  checkWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  getGameDisplayName() {
    return "Tic Tac Toe";
  }

  getMinPlayers() {
    return 2;
  }

  getMaxPlayers() {
    return 2;
  }

  // Helper methods
  async getQueueLength() {
    const redis = await this.getRedis();
    return await redis.lLen(this.queueKey);
  }

  async popFromQueue() {
    const redis = await this.getRedis();
    return await redis.lPop(this.queueKey);
  }

  async addToQueue(player) {
    const redis = await this.getRedis();
    return await redis.rPush(this.queueKey, JSON.stringify(player));
  }

  async createMatch(players) {
    const roomId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    console.log(`Creating match: ${players[0].username} vs ${players[1].username} in room ${roomId}`);

    // Create session data
    const sessionData = {
      roomId,
      players: {
        [players[0].userId]: { name: players[0].username },
        [players[1].userId]: { name: players[1].username }
      },
      createdAt: Date.now(),
      status: 'active',
      gameState: this.createInitialGameState(players)
    };

    // Store session
    await this.updateSession(roomId, sessionData);

    // Map users to session
    await this.setUserSession(players[0].userId, roomId);
    await this.setUserSession(players[1].userId, roomId);

    console.log(`Match created successfully for room ${roomId}`);
    return { matched: true, roomId };
  }
}

// Create and export a singleton instance
const ticTacToeGame = new TicTacToeGame();

// Export the functions for backward compatibility
export const handleMatchmaking = (userId, username) => ticTacToeGame.handleMatchmaking(userId, username);
export const cancelMatchmaking = (userId) => ticTacToeGame.cancelMatchmaking(userId);