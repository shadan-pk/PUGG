// backend/index.js
import express from "express";
import cors from "cors";
import { handleMatchmaking, cancelMatchmaking } from "./games/tictactoe.js";
import { createClient } from 'redis';

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
    res.json(game);
  } catch (error) {
    console.error("Move error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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