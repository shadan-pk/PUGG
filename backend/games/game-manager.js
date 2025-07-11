// backend/games/game-manager.js
import { TicTacToeGame } from './tictactoe.js';

class GameManager {
  constructor() {
    this.games = new Map();
    this.initializeGames();
  }

  initializeGames() {
    // Register all games
    this.registerGame('tictactoe', new TicTacToeGame());
  }

  registerGame(gameType, gameInstance) {
    this.games.set(gameType, gameInstance);
    console.log(`Registered game: ${gameType} - ${gameInstance.getGameDisplayName()}`);
  }

  getGame(gameType) {
    const game = this.games.get(gameType);
    if (!game) {
      throw new Error(`Game type '${gameType}' not found`);
    }
    return game;
  }

  getAvailableGames() {
    const games = [];
    for (const [gameType, game] of this.games) {
      games.push({
        type: gameType,
        name: game.getGameDisplayName(),
        minPlayers: game.getMinPlayers(),
        maxPlayers: game.getMaxPlayers()
      });
    }
    return games;
  }

  async handleMatchmaking(gameType, userId, username) {
    const game = this.getGame(gameType);
    return await game.handleMatchmaking(userId, username);
  }

  async cancelMatchmaking(gameType, userId) {
    const game = this.getGame(gameType);
    return await game.cancelMatchmaking(userId);
  }

  async getSession(gameType, roomId) {
    const game = this.getGame(gameType);
    return await game.getSession(roomId);
  }

  async updateSession(gameType, roomId, sessionData) {
    const game = this.getGame(gameType);
    return await game.updateSession(roomId, sessionData);
  }

  async deleteSession(gameType, roomId) {
    const game = this.getGame(gameType);
    return await game.deleteSession(roomId);
  }

  async getUserSession(gameType, userId) {
    const game = this.getGame(gameType);
    return await game.getUserSession(userId);
  }

  async setUserSession(gameType, userId, roomId) {
    const game = this.getGame(gameType);
    return await game.setUserSession(userId, roomId);
  }

  async deleteUserSession(gameType, userId) {
    const game = this.getGame(gameType);
    return await game.deleteUserSession(userId);
  }

  validateMove(gameType, gameState, userId, moveData) {
    const game = this.getGame(gameType);
    return game.validateMove(gameState, userId, moveData);
  }

  makeMove(gameType, gameState, userId, moveData) {
    const game = this.getGame(gameType);
    return game.makeMove(gameState, userId, moveData);
  }

  checkGameEnd(gameType, gameState) {
    const game = this.getGame(gameType);
    return game.checkGameEnd(gameState);
  }
}

// Create and export singleton instance
const gameManager = new GameManager();
export default gameManager; 