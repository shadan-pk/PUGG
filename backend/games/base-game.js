// backend/games/base-game.js
import { createClient } from 'redis';

const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect().catch(console.error);

export class BaseGame {
  constructor(gameType) {
    this.gameType = gameType;
    this.queueKey = `${gameType}:queue`;
    this.sessionPrefix = `${gameType}:session:`;
    this.redis = null;
  }

  async getRedis() {
    if (!this.redis) {
      const { createClient } = await import('redis');
      this.redis = createClient({ url: 'redis://localhost:6379' });
      await this.redis.connect();
    }
    return this.redis;
  }

  // Common matchmaking logic
  async handleMatchmaking(userId, username) {
    const redis = await this.getRedis();
    // HARD RESET: Remove user from queue if present and delete their session mapping
    const queue = await redis.lRange(this.queueKey, 0, -1);
    for (let i = 0; i < queue.length; i++) {
      const player = JSON.parse(queue[i]);
      if (player.userId === userId) {
        await redis.lRem(this.queueKey, 1, queue[i]);
        console.log(`[HARD RESET] Removed ${userId} from queue`);
        break;
      }
    }
    await redis.del(`user:${userId}:session`);
    console.log(`[HARD RESET] Deleted user-to-session mapping for user:${userId}:session`);

    // Defensive: Check if user is already in a session, and if the session actually exists and is valid
    const userSessionKey = `user:${userId}:session`;
    const existingSessionId = await redis.get(userSessionKey);
    if (existingSessionId) {
      const sessionExists = await redis.exists(`${this.sessionPrefix}${existingSessionId}`);
      if (sessionExists) {
        // Check if the session is still valid (not finished/cleaned up)
        const sessionData = await redis.get(`${this.sessionPrefix}${existingSessionId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          // Only return existing session if it's active (not finished)
          if (session.status === 'active' && !session.gameState?.winner) {
            console.log(`User ${userId} already in active session ${existingSessionId}`);
            return { matched: true, roomId: existingSessionId };
          } else {
            // Session is finished, clean it up
            console.log(`Cleaning up finished session ${existingSessionId} for user ${userId}`);
            await redis.del(`${this.sessionPrefix}${existingSessionId}`);
            await redis.del(userSessionKey);
          }
        } else {
          // Session data is corrupted, clean up
          await redis.del(userSessionKey);
          console.log(`Cleaned up corrupted session mapping for user ${userId}`);
        }
      } else {
        // Clean up stale mapping
        await redis.del(userSessionKey);
        console.log(`Cleaned up stale session mapping for user ${userId}`);
      }
    }

    // Add user to the matchmaking queue
    await redis.rPush(this.queueKey, JSON.stringify({ userId, username }));
    console.log(`Added ${username} (${userId}) to ${this.gameType} queue`);

    // Check queue length
    const queueLength = await redis.lLen(this.queueKey);
    console.log(`${this.gameType} queue length after adding ${username}: ${queueLength}`);

    // Try to match players (implemented by subclasses)
    return await this.tryMatchPlayers();
  }

  // Common cancel matchmaking logic
  async cancelMatchmaking(userId) {
    const redis = await this.getRedis();
    // Remove user from queue
    const queue = await redis.lRange(this.queueKey, 0, -1);
    for (let i = 0; i < queue.length; i++) {
      const player = JSON.parse(queue[i]);
      if (player.userId === userId) {
        await redis.lRem(this.queueKey, 1, queue[i]);
        console.log(`Removed ${player.username} from ${this.gameType} queue`);
        break;
      }
    }
    // Remove session mapping if exists
    await redis.del(`user:${userId}:session`);
    console.log(`Deleted user-to-session mapping for user:${userId}:session`);
  }

  // Common session management
  async getSession(roomId) {
    const redis = await this.getRedis();
    const sessionKey = `${this.sessionPrefix}${roomId}`;
    const sessionData = await redis.get(sessionKey);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async updateSession(roomId, sessionData) {
    const redis = await this.getRedis();
    const sessionKey = `${this.sessionPrefix}${roomId}`;
    await redis.set(sessionKey, JSON.stringify(sessionData));
  }

  async deleteSession(roomId) {
    const redis = await this.getRedis();
    const sessionKey = `${this.sessionPrefix}${roomId}`;
    await redis.del(sessionKey);
  }

  // Common user session mapping
  async getUserSession(userId) {
    const redis = await this.getRedis();
    return await redis.get(`user:${userId}:session`);
  }

  async setUserSession(userId, roomId) {
    const redis = await this.getRedis();
    await redis.set(`user:${userId}:session`, roomId);
  }

  async deleteUserSession(userId) {
    const redis = await this.getRedis();
    await redis.del(`user:${userId}:session`);
  }

  // Get queue length
  async getQueueLength() {
    const redis = await this.getRedis();
    return await redis.lLen(this.queueKey);
  }

  // Pop from queue
  async popFromQueue() {
    const redis = await this.getRedis();
    return await redis.lPop(this.queueKey);
  }

  // Add to queue
  async addToQueue(player) {
    const redis = await this.getRedis();
    return await redis.rPush(this.queueKey, JSON.stringify(player));
  }

  // Create a new match
  async createMatch(players) {
    const redis = await this.getRedis();
    const roomId = `${this.gameType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔧 Creating match with room ID: ${roomId} for game type: ${this.gameType}`);
    
    // Create initial game state
    const gameState = this.createInitialGameState(players);
    
    // Create session data
    const sessionData = {
      roomId,
      gameType: this.gameType,
      players,
      gameState,
      status: 'active',
      createdAt: Date.now()
    };
    
    // Save session to Redis
    await redis.set(`${this.sessionPrefix}${roomId}`, JSON.stringify(sessionData));
    
    // Map each player to the session
    for (const player of players) {
      await redis.set(`user:${player.userId}:session`, roomId);
    }
    
    console.log(`Created ${this.gameType} match ${roomId} with ${players.length} players`);
    return { matched: true, roomId };
  }

  // Abstract methods that must be implemented by subclasses
  async tryMatchPlayers() {
    throw new Error('tryMatchPlayers must be implemented by subclass');
  }

  createInitialGameState(players) {
    throw new Error('createInitialGameState must be implemented by subclass');
  }

  validateMove(gameState, userId, moveData) {
    throw new Error('validateMove must be implemented by subclass');
  }

  makeMove(gameState, userId, moveData) {
    throw new Error('makeMove must be implemented by subclass');
  }

  checkGameEnd(gameState) {
    throw new Error('checkGameEnd must be implemented by subclass');
  }

  getGameDisplayName() {
    throw new Error('getGameDisplayName must be implemented by subclass');
  }

  getMinPlayers() {
    throw new Error('getMinPlayers must be implemented by subclass');
  }

  getMaxPlayers() {
    throw new Error('getMaxPlayers must be implemented by subclass');
  }
} 