import express from "express";
import { handleMatchmaking } from "./games/tictactoe.js";
const app = express();
app.use(express.json());

app.post("/matchmaking/tictactoe", async (req, res) => {
  const { userId, username } = req.body;
  const result = await handleMatchmaking(userId, username);
  res.json(result);
});

app.listen(3001, () => console.log("Matchmaking server running on port 3001"));
