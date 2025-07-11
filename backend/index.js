// backend/index.js
import express from "express";
import cors from "cors";
import { handleMatchmaking, cancelMatchmaking } from "./games/tictactoe.js";
import { createClient } from 'redis';
import { db as firestore } from "./utils/firestore.js";

const redis = createClient({ url: 'redis://localhost:6379' });
redis.connect().catch(console.error);

const app = express();
app.use(cors({ 
  origin: ["http://localhost:3000", "http://localhost:3002"] // Allow both frontend ports
}));
app.use(express.json());

app.post("/matchmaking/tictactoe", async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "userId and username are required" });
    }
    console.log(`Matchmaking request: ${userId} (${username})`);
    const result = await handleMatchmaking(userId, username);
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
    await cancelMatchmaking(userId);
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
      return res.json({ matched: true, roomId: sessionId });
    }
    return res.json({ matched: false });
  } catch (error) {
    console.error("Status matchmaking error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET game state
app.get("/game/tictactoe/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const sessionKey = `tictactoe:session:${roomId}`;
    const sessionData = await redis.get(sessionKey);
    if (!sessionData) {
      return res.status(404).json({ error: "Game not found" });
    }
    res.json(JSON.parse(sessionData));
  } catch (error) {
    console.error("Get game state error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST make move
app.post("/game/tictactoe/:roomId/move", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, index } = req.body;
    const sessionKey = `tictactoe:session:${roomId}`;
    const sessionData = await redis.get(sessionKey);
    if (!sessionData) {
      return res.status(404).json({ error: "Game not found" });
    }
    const game = JSON.parse(sessionData);
    const { gameState } = game;
    if (!gameState || gameState.board[index] || gameState.winner) {
      return res.status(400).json({ error: "Invalid move" });
    }
    // Validate player
    const isPlayerX = gameState.playerX === userId;
    const isPlayerO = gameState.playerO === userId;
    const isCurrentPlayer =
      (gameState.currentPlayer === "X" && isPlayerX) ||
      (gameState.currentPlayer === "O" && isPlayerO);
    if (!isCurrentPlayer) {
      return res.status(400).json({ error: "Not your turn" });
    }
    // Make move
    const newBoard = [...gameState.board];
    newBoard[index] = gameState.currentPlayer;
    const winner = checkWinner(newBoard);
    const isDraw = !winner && newBoard.every((cell) => cell !== null);
    const newGameState = {
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === "X" ? "O" : "X",
      winner: winner || (isDraw ? "draw" : null),
      moves: gameState.moves + 1,
    };
    game.gameState = newGameState;
    await redis.set(sessionKey, JSON.stringify(game));
    // If game finished, update stats
    if (winner || isDraw) {
      await updatePlayerStats(game, winner, isDraw);
      // Mark game as finished but keep session for result screen
      game.status = "finished";
      await redis.set(sessionKey, JSON.stringify(game));
      console.log(`Game finished, session kept for result screen: ${roomId}`);
      // Schedule cleanup after 30 seconds
      setTimeout(async () => {
        try {
          await redis.del(sessionKey);
          const playerX = game.gameState.playerX;
          const playerO = game.gameState.playerO;
          await redis.del(`user:${playerX}:session`);
          await redis.del(`user:${playerO}:session`);
          console.log(`Auto-cleaned up session after timeout: ${roomId}`);
        } catch (error) {
          console.error("Error in auto-cleanup:", error);
        }
      }, 30000);
    }
    res.json(game);
  } catch (error) {
    console.error("Move error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST leave game
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
    console.log(`Player forfeited, session kept for result screen: ${roomId}`);
    // Schedule cleanup after 30 seconds
    setTimeout(async () => {
      try {
        await redis.del(sessionKey);
        const playerX = gameState.playerX;
        const playerO = gameState.playerO;
        await redis.del(`user:${playerX}:session`);
        await redis.del(`user:${playerO}:session`);
        console.log(`Auto-cleaned up session after timeout: ${roomId}`);
      } catch (error) {
        console.error("Error in auto-cleanup:", error);
      }
    }, 30000);
    res.json({ message: "Player left, opponent wins", winner: winnerId });
  } catch (error) {
    console.error("Leave game error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST cleanup game session
app.post("/game/tictactoe/:roomId/cleanup", async (req, res) => {
  try {
    const { roomId } = req.params;
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
    // Delete session and user mappings
    await redis.del(sessionKey);
    const playerX = gameState.playerX;
    const playerO = gameState.playerO;
    await redis.del(`user:${playerX}:session`);
    await redis.del(`user:${playerO}:session`);
    console.log(`Manually cleaned up session: ${roomId}`);
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Matchmaking server running on port ${PORT}`);
});