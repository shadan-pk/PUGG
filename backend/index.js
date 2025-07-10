import express from "express";
import cors from "cors";
import { handleMatchmaking } from "./games/tictactoe.js";
const app = express();

app.use(cors({ origin: "http://localhost:3000" })); // Allow your frontend origin
app.use(express.json());

app.post("/matchmaking/tictactoe", async (req, res) => {
  const { userId, username } = req.body;
  const result = await handleMatchmaking(userId, username);
  res.json(result);
});

app.listen(3001, () => console.log("Matchmaking server running on port 3001"));