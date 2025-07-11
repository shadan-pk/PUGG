// backend/index.js
import express from "express";
import cors from "cors";
import { handleMatchmaking, cancelMatchmaking } from "./games/tictactoe.js";
import { createClient } from 'redis';
import { db as firestore } from "./utils/firestore.js";
import gameManager from "./games/game-manager.js";

const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect().catch(console.error);

const app = express();
app.use(cors({ 
  origin: ["http://localhost:3000", "http://localhost:3002"] // Allow both frontend ports
}));
app.use(express.json());

// Track players on result screen
const playersOnResultScreen = new Map(); // roomId -> Set of userIds
const resultScreenTimeouts = new Map(); // roomId -> timeout

// GET available games
app.get("/games", (req, res) => {
  try {
    const availableGames = gameManager.getAvailableGames();
    res.json(availableGames);
  } catch (error) {
    console.error("Error getting available games:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic matchmaking endpoint for any game type
app.post("/matchmaking/:gameType", async (req, res) => {
  try {
    const { gameType } = req.params;
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "userId and username are required" });
    }
    console.log(`Matchmaking request for ${gameType}: ${userId} (${username})`);
    const result = await gameManager.handleMatchmaking(gameType, userId, username);
    console.log(`Matchmaking result for ${userId} in ${gameType}:`, result);
    res.json(result);
  } catch (error) {
    console.error("Matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/matchmaking/:gameType/cancel", async (req, res) => {
  try {
    const { gameType } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    await gameManager.cancelMatchmaking(gameType, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Cancel matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic endpoint for polling matchmaking status
app.get("/matchmaking/:gameType/status", async (req, res) => {
  try {
    const { gameType } = req.params;
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const sessionId = await redis.get(`user:${userId}:session`);
    if (sessionId) {
      // Validate that the session is still valid and accessible
      const gameTypes = ['tictactoe', 'connect-four']; // Add more as needed
      let validSession = false;
      
      for (const gt of gameTypes) {
        const sessionKey = `${gt}:session:${sessionId}`;
        const sessionData = await redis.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          // Check if this is an active session or if user is still on result screen
          if (session.status === 'active' || 
              (session.status === 'finished' && playersOnResultScreen.has(sessionId))) {
            validSession = true;
            break;
          } else {
            // Session is finished and no players on result screen, clean up the mapping
            console.log(`[STATUS] Cleaning up stale session mapping for user ${userId} to ${sessionId}`);
            await redis.del(`user:${userId}:session`);
            break;
          }
        }
      }
      
      if (validSession) {
        return res.json({ matched: true, roomId: sessionId });
      } else {
        // Clean up invalid session mapping
        await redis.del(`user:${userId}:session`);
        return res.json({ matched: false });
      }
    }
    return res.json({ matched: false });
  } catch (error) {
    console.error("Status matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Keep legacy tictactoe endpoints for backward compatibility
app.post("/matchmaking/tictactoe", async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "userId and username are required" });
    }
    console.log(`Matchmaking request: ${userId} (${username})`);
    const result = await gameManager.handleMatchmaking('tictactoe', userId, username);
    console.log(`Matchmaking result for ${userId}:`, result);
    res.json(result);
  } catch (error) {
    console.error("Matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/matchmaking/tictactoe/cancel", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    await gameManager.cancelMatchmaking('tictactoe', userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Cancel matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New endpoint for polling matchmaking status
app.get("/matchmaking/tictactoe/status", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const sessionId = await redis.get(`user:${userId}:session`);
    if (sessionId) {
      // Validate that the session is still valid and accessible
      const sessionKey = `tictactoe:session:${sessionId}`;
      const sessionData = await redis.get(sessionKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        // Check if this is an active session or if user is still on result screen
        if (session.status === 'active' || 
            (session.status === 'finished' && playersOnResultScreen.has(sessionId))) {
          return res.json({ matched: true, roomId: sessionId });
        } else {
          // Session is finished and no players on result screen, clean up the mapping
          console.log(`[STATUS] Cleaning up stale session mapping for user ${userId} to ${sessionId}`);
          await redis.del(`user:${userId}:session`);
          return res.json({ matched: false });
        }
      } else {
        // Session doesn't exist, clean up the mapping
        await redis.del(`user:${userId}:session`);
        return res.json({ matched: false });
      }
    }
    return res.json({ matched: false });
  } catch (error) {
    console.error("Status matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic game state endpoint for any game type
app.get("/game/:gameType/:roomId", async (req, res) => {
  try {
    const { gameType, roomId } = req.params;
    console.log(`🎮 GET /game/${gameType}/${roomId} - Requesting game state`);
    const sessionData = await gameManager.getSession(gameType, roomId);
    if (!sessionData) {
      console.log(`❌ Game not found: ${gameType}/${roomId}`);
      return res.status(404).json({ error: "Game not found" });
    }
    
    // Check if this is a finished game that should still be accessible
    if (sessionData.status === 'finished' || sessionData.gameState?.winner) {
      // Check if there are still players on the result screen
      const playersOnResult = playersOnResultScreen.get(roomId);
      if (!playersOnResult || playersOnResult.size === 0) {
        console.log(`⚠️ Finished game ${roomId} has no players on result screen, may be cleaned up`);
        // Don't return 404 immediately, let the frontend handle it gracefully
      }
    }
    
    console.log(`✅ Game found: ${gameType}/${roomId}`);
    res.json(sessionData);
  } catch (error) {
    console.error("Get game state error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET game state (legacy tictactoe endpoint)
app.get("/game/tictactoe/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const sessionData = await gameManager.getSession('tictactoe', roomId);
    if (!sessionData) {
      return res.status(404).json({ error: "Game not found" });
    }
    res.json(sessionData);
  } catch (error) {
    console.error("Get game state error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic move endpoint for any game type
app.post("/game/:gameType/:roomId/move", async (req, res) => {
  try {
    const { gameType, roomId } = req.params;
    const { userId, ...moveData } = req.body;
    
    const game = await gameManager.getSession(gameType, roomId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }
    
    const { gameState } = game;
    if (!gameState) {
      return res.status(400).json({ error: "Invalid game state" });
    }
    
    // Validate move using game manager
    const validation = gameManager.validateMove(gameType, gameState, userId, moveData);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Make move using game manager
    const newGameState = gameManager.makeMove(gameType, gameState, userId, moveData);
    game.gameState = newGameState;
    
    // Check if game ended
    const gameEnd = gameManager.checkGameEnd(gameType, newGameState);
    
    if (gameEnd.finished) {
      await updatePlayerStats(game, gameEnd.winner, gameEnd.isDraw);
      game.status = "finished";
      
      // Check if result screen tracking already exists
      if (!playersOnResultScreen.has(roomId)) {
        // Initialize result screen tracking for both players
        const playerX = game.gameState.playerX;
        const playerO = game.gameState.playerO;
        playersOnResultScreen.set(roomId, new Set([playerX, playerO]));
        
        // Set timeout for automatic cleanup (60 seconds)
        const timeout = setTimeout(async () => {
          console.log(`Auto-cleanup timeout triggered for room: ${roomId}`);
          await cleanupResultScreen(roomId);
        }, 60000);
        resultScreenTimeouts.set(roomId, timeout);
        
        console.log(`Game finished, result screen initialized: ${roomId}`);
      } else {
        console.log(`Result screen already initialized for room: ${roomId}`);
      }
    }
    
    await gameManager.updateSession(gameType, roomId, game);
    res.json(game);
  } catch (error) {
    console.error("Move error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST make move (legacy tictactoe endpoint)
app.post("/game/tictactoe/:roomId/move", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, ...moveData } = req.body;
    
    const game = await gameManager.getSession('tictactoe', roomId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }
    
    const { gameState } = game;
    if (!gameState) {
      return res.status(400).json({ error: "Invalid game state" });
    }
    
    // Validate move using game manager
    const validation = gameManager.validateMove('tictactoe', gameState, userId, moveData);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Make move using game manager
    const newGameState = gameManager.makeMove('tictactoe', gameState, userId, moveData);
    game.gameState = newGameState;
    
    // Check if game ended
    const gameEnd = gameManager.checkGameEnd('tictactoe', newGameState);
    
    if (gameEnd.finished) {
      await updatePlayerStats(game, gameEnd.winner, gameEnd.isDraw);
      game.status = "finished";
      
      // Check if result screen tracking already exists
      if (!playersOnResultScreen.has(roomId)) {
        // Initialize result screen tracking for both players
        const playerX = game.gameState.playerX;
        const playerO = game.gameState.playerO;
        playersOnResultScreen.set(roomId, new Set([playerX, playerO]));
        
        // Set timeout for automatic cleanup (60 seconds)
        const timeout = setTimeout(async () => {
          console.log(`Auto-cleanup timeout triggered for room: ${roomId}`);
          await cleanupResultScreen(roomId);
        }, 60000);
        resultScreenTimeouts.set(roomId, timeout);
        
        console.log(`Game finished, result screen initialized: ${roomId}`);
      } else {
        console.log(`Result screen already initialized for room: ${roomId}`);
      }
    }
    
    await gameManager.updateSession('tictactoe', roomId, game);
    res.json(game);
  } catch (error) {
    console.error("Move error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic leave game endpoint for any game type
app.post("/game/:gameType/:roomId/leave", async (req, res) => {
  try {
    const { gameType, roomId } = req.params;
    const { userId } = req.body;
    const sessionKey = `${gameType}:session:${roomId}`;
    const sessionData = await redis.get(sessionKey);
    if (!sessionData) {
      return res.status(404).json({ error: "Game not found" });
    }
    const game = JSON.parse(sessionData);
    const { gameState } = game;
    if (!gameState) {
      return res.status(400).json({ error: "Invalid game state" });
    }
    if (gameState.winner) {
      // Game already finished, do nothing
      return res.json({ message: "Game already finished" });
    }
    // Determine the other player
    let winnerId = null;
    if (gameState.playerX === userId) {
      winnerId = gameState.playerO;
    } else if (gameState.playerO === userId) {
      winnerId = gameState.playerX;
    } else {
      return res.status(400).json({ error: "User not in this game" });
    }
    // Set winner and update game state
    gameState.winner = (gameState.playerX === winnerId) ? "X" : "O";
    game.status = "finished";
    await redis.set(sessionKey, JSON.stringify(game));
    // Update stats in Firestore
    await updatePlayerStats(game, gameState.winner, false, userId);
    
    // Check if result screen tracking already exists
    if (!playersOnResultScreen.has(roomId)) {
      // Initialize result screen tracking for both players
      const playerX = gameState.playerX;
      const playerO = gameState.playerO;
      playersOnResultScreen.set(roomId, new Set([playerX, playerO]));
      
      // Set timeout for automatic cleanup (60 seconds)
      const timeout = setTimeout(async () => {
        console.log(`Auto-cleanup timeout triggered for room: ${roomId}`);
        await cleanupResultScreen(roomId);
      }, 60000);
      resultScreenTimeouts.set(roomId, timeout);
      
      console.log(`Player forfeited, result screen initialized: ${roomId}`);
    } else {
      console.log(`Result screen already initialized for room: ${roomId}`);
    }
    res.json({ message: "Player left, opponent wins", winner: winnerId });
  } catch (error) {
    console.error("Leave game error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST leave game (legacy tictactoe endpoint)
app.post("/game/tictactoe/:roomId/leave", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    const sessionKey = `tictactoe:session:${roomId}`;
    const sessionData = await redis.get(sessionKey);
    if (!sessionData) {
      return res.status(404).json({ error: "Game not found" });
    }
    const game = JSON.parse(sessionData);
    const { gameState } = game;
    if (!gameState) {
      return res.status(400).json({ error: "Invalid game state" });
    }
    if (gameState.winner) {
      // Game already finished, do nothing
      return res.json({ message: "Game already finished" });
    }
    // Determine the other player
    let winnerId = null;
    if (gameState.playerX === userId) {
      winnerId = gameState.playerO;
    } else if (gameState.playerO === userId) {
      winnerId = gameState.playerX;
    } else {
      return res.status(400).json({ error: "User not in this game" });
    }
    // Set winner and update game state
    gameState.winner = (gameState.playerX === winnerId) ? "X" : "O";
    game.status = "finished";
    await redis.set(sessionKey, JSON.stringify(game));
    // Update stats in Firestore
    await updatePlayerStats(game, gameState.winner, false, userId);
    
    // Check if result screen tracking already exists
    if (!playersOnResultScreen.has(roomId)) {
      // Initialize result screen tracking for both players
      const playerX = gameState.playerX;
      const playerO = gameState.playerO;
      playersOnResultScreen.set(roomId, new Set([playerX, playerO]));
      
      // Set timeout for automatic cleanup (60 seconds)
      const timeout = setTimeout(async () => {
        console.log(`Auto-cleanup timeout triggered for room: ${roomId}`);
        await cleanupResultScreen(roomId);
      }, 60000);
      resultScreenTimeouts.set(roomId, timeout);
      
      console.log(`Player forfeited, result screen initialized: ${roomId}`);
    } else {
      console.log(`Result screen already initialized for room: ${roomId}`);
    }
    res.json({ message: "Player left, opponent wins", winner: winnerId });
  } catch (error) {
    console.error("Leave game error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generic leave result screen endpoint for any game type
app.post("/game/:gameType/:roomId/leave-result", async (req, res) => {
  try {
    const { gameType, roomId } = req.params;
    const { userId } = req.body;
    
    const playersOnResult = playersOnResultScreen.get(roomId);
    if (!playersOnResult) {
      return res.status(404).json({ error: "Result screen not found" });
    }
    
    // Remove player from result screen
    playersOnResult.delete(userId);
    
    // Clean up user-to-session mapping for this user
    await redis.del(`user:${userId}:session`);
    console.log(`[LEAVE-RESULT] Cleaned up user mapping for ${userId} from room ${roomId}`);
    
    // If no players left on result screen, cleanup the room
    if (playersOnResult.size === 0) {
      await cleanupResultScreen(roomId);
    }
    
    res.json({ message: "Left result screen" });
  } catch (error) {
    console.error("Leave result screen error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST leave result screen (legacy tictactoe endpoint)
app.post("/game/tictactoe/:roomId/leave-result", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    const playersOnResult = playersOnResultScreen.get(roomId);
    if (!playersOnResult) {
      return res.status(404).json({ error: "Result screen not found" });
    }
    
    // Remove player from result screen
    playersOnResult.delete(userId);
    
    // Clean up user-to-session mapping for this user
    await redis.del(`user:${userId}:session`);
    console.log(`[LEAVE-RESULT] Cleaned up user mapping for ${userId} from room ${roomId}`);
    
    // If no players left on result screen, cleanup the room
    if (playersOnResult.size === 0) {
      await cleanupResultScreen(roomId);
    }
    
    res.json({ message: "Left result screen" });
  } catch (error) {
    console.error("Leave result screen error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST cleanup game session (legacy endpoint, kept for compatibility)
app.post("/game/tictactoe/:roomId/cleanup", async (req, res) => {
  try {
    const { roomId } = req.params;
    await cleanupResultScreen(roomId);
    res.json({ message: "Session cleaned up" });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function updatePlayerStats(game, winner, isDraw, forfeitUserId = null) {
  try {
    const playerX = game.gameState.playerX;
    const playerO = game.gameState.playerO;
    const userRefs = [
      firestore.collection("users").doc(playerX),
      firestore.collection("users").doc(playerO),
    ];
    const updates = [
      { gamesPlayed: 1, wins: 0, losses: 0, draws: 0 },
      { gamesPlayed: 1, wins: 0, losses: 0, draws: 0 },
    ];
    if (isDraw) {
      updates[0].draws = 1;
      updates[1].draws = 1;
    } else if (winner === "X") {
      updates[0].wins = 1;
      updates[1].losses = 1;
    } else if (winner === "O") {
      updates[0].losses = 1;
      updates[1].wins = 1;
    }
    // If forfeit, adjust winner/loser
    if (forfeitUserId) {
      if (playerX === forfeitUserId) {
        updates[0].losses = 1;
        updates[0].wins = 0;
        updates[1].wins = 1;
        updates[1].losses = 0;
      } else if (playerO === forfeitUserId) {
        updates[1].losses = 1;
        updates[1].wins = 0;
        updates[0].wins = 1;
        updates[0].losses = 0;
      }
    }
    // Use Firestore transactions to update stats
    await firestore.runTransaction(async (t) => {
      for (let i = 0; i < 2; i++) {
        const userRef = userRefs[i];
        const userSnap = await t.get(userRef);
        const stats = userSnap.exists && userSnap.data().stats ? userSnap.data().stats : { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        t.update(userRef, {
          "stats.gamesPlayed": (stats.gamesPlayed || 0) + updates[i].gamesPlayed,
          "stats.wins": (stats.wins || 0) + updates[i].wins,
          "stats.losses": (stats.losses || 0) + updates[i].losses,
          "stats.draws": (stats.draws || 0) + updates[i].draws,
        });
      }
    });
    console.log(`Updated stats for ${playerX} and ${playerO}`);
  } catch (error) {
    console.error("Error updating player stats:", error);
  }
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// Helper function to cleanup result screen
async function cleanupResultScreen(roomId) {
  try {
    console.log(`Starting cleanup for room: ${roomId}`);
    
    // Check if cleanup is already in progress
    if (!playersOnResultScreen.has(roomId)) {
      console.log(`Room ${roomId} already cleaned up or not tracked`);
      return;
    }
    
    // Extract game type from room ID (format: gameType-timestamp-random)
    const parts = roomId.split('-');
    const gameType = parts.slice(0, -2).join('-');
    
    // Try to find session data for this game type
    const sessionKey = `${gameType}:session:${roomId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const game = JSON.parse(sessionData);
      const { gameState } = game;
      
      // Delete session and user mappings
      await redis.del(sessionKey);
      if (gameState) {
        const playerX = gameState.playerX;
        const playerO = gameState.playerO;
        
        // Delete user-to-session mappings
        await redis.del(`user:${playerX}:session`);
        await redis.del(`user:${playerO}:session`);
        
        // Also remove from queue if they're still there
        const queueKey = `${gameType}:queue`;
        const queue = await redis.lRange(queueKey, 0, -1);
        for (let i = 0; i < queue.length; i++) {
          const player = JSON.parse(queue[i]);
          if (player.userId === playerX || player.userId === playerO) {
            await redis.lRem(queueKey, 1, queue[i]);
            console.log(`Removed ${player.userId} from queue during cleanup`);
          }
        }
        
        console.log(`Deleted session and user mappings for room: ${roomId} (game: ${gameType})`);
      }
    } else {
      console.log(`Session data not found for room: ${roomId} (game: ${gameType})`);
    }
    
    // Clear tracking data
    playersOnResultScreen.delete(roomId);
    const timeout = resultScreenTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      resultScreenTimeouts.delete(roomId);
      console.log(`Cleared timeout for room: ${roomId}`);
    }
    
    console.log(`Successfully cleaned up result screen: ${roomId}`);
  } catch (error) {
    console.error(`Error in cleanupResultScreen for room ${roomId}:`, error);
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Graceful shutdown cleanup
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Clear all timeouts
  for (const [roomId, timeout] of resultScreenTimeouts) {
    clearTimeout(timeout);
    console.log(`Cleared timeout for room: ${roomId}`);
  }
  
  // Clean up all result screen tracking
  playersOnResultScreen.clear();
  resultScreenTimeouts.clear();
  
  // Close Redis connection
  await redis.quit();
  console.log('Server shutdown complete');
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`=== MATCHMAKING SERVER STARTED ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Result screen management: ENABLED`);
  console.log(`Auto-cleanup timeout: 60 seconds`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`=====================================`);
});