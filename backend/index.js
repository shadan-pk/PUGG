// backend/index.js
import express from "express";
import cors from "cors";
// import {  cancelMatchmaking, cleanupStaleQueue } from "./games/tictactoe.js";

const app = express();

app.use(cors({ origin: "http://localhost:3000" })); // Allow your frontend origin
app.use(express.json());

app.post("/matchmaking/tictactoe", async (req, res) => {
  try {
    const { userId, username } = req.body;
    
    if (!userId || !username) {
      return res.status(400).json({ error: "userId and username are required" });
    }
    
    const result = await handleMatchmaking(userId, username);
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

// Cleanup stale queue entries every 5 minutes
setInterval(async () => {
  try {
    await cleanupStaleQueue();
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}, 5 * 60 * 1000);

app.listen(3001, () => {
  console.log("Matchmaking server running on port 3001");
  console.log("Stale queue cleanup scheduled every 5 minutes");
});

// backend/games/tictactoe.js
import { db } from "./utils/firestore.js";
  
export async function handleMatchmaking(userId, username) {
  const queueRef = db.collection("tictactoe_queue");
  
  try {
    // Use a transaction to prevent race conditions
    return await db.runTransaction(async (transaction) => {
      // First, check if this user is already in queue or matched
      const userQueueDoc = await transaction.get(queueRef.doc(userId));
      
      if (userQueueDoc.exists) {
        const userData = userQueueDoc.data();
        if (userData.status === "matched" && userData.roomId) {
          // User is already matched, return the existing room
          console.log(`User ${userId} already matched to room ${userData.roomId}`);
          return { matched: true, roomId: userData.roomId };
        }
      }
      
      // Add/update player in queue with waiting status
      transaction.set(queueRef.doc(userId), { 
        userId, 
        username, 
        joinedAt: Date.now(),
        status: "waiting"
      });
      
      // Look for other waiting players (excluding current user)
      const waitingPlayersSnapshot = await transaction.get(
        queueRef.where("status", "==", "waiting").orderBy("joinedAt")
      );
      
      const waitingPlayers = waitingPlayersSnapshot.docs
        .map(doc => doc.data())
        .filter(player => player.userId !== userId);
      
      // If we have another player available, create a match
      if (waitingPlayers.length > 0) {
        const opponent = waitingPlayers[0];
        const players = [
          { userId, username },
          { userId: opponent.userId, username: opponent.username }
        ];
        
        // Create game room with predetermined ID
        const roomRef = db.collection("rooms").doc();
        const roomId = roomRef.id;
        
        transaction.set(roomRef, {
          game: "tictactoe",
          players: players,
          createdAt: Date.now(),
          status: "active",
          currentPlayer: userId, // First player (the one who joined second) starts
          board: Array(9).fill(null),
          winner: null,
          gameState: "playing"
        });
        
        // Mark both players as matched with the same room ID
        transaction.update(queueRef.doc(userId), { 
          roomId: roomId, 
          status: "matched",
          matchedAt: Date.now()
        });
        transaction.update(queueRef.doc(opponent.userId), { 
          roomId: roomId, 
          status: "matched",
          matchedAt: Date.now()
        });
        
        console.log(`Match created: ${userId} vs ${opponent.userId} in room ${roomId}`);
        
        // Schedule cleanup of queue docs after a delay
        setTimeout(async () => {
          try {
            const batch = db.batch();
            batch.delete(queueRef.doc(userId));
            batch.delete(queueRef.doc(opponent.userId));
            await batch.commit();
            console.log(`Cleaned up queue for room ${roomId}`);
          } catch (error) {
            console.error("Error cleaning up queue:", error);
          }
        }, 2000); // 2 second delay to ensure both clients get the match notification
        
        return { matched: true, roomId: roomId };
      }
      
      console.log(`User ${userId} added to queue, waiting for opponent`);
      return { matched: false };
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

export async function cancelMatchmaking(userId) {
  const queueRef = db.collection("tictactoe_queue");
  
  try {
    const userDoc = await queueRef.doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Only cancel if user is still waiting
      if (userData.status === "waiting") {
        await queueRef.doc(userId).delete();
        console.log(`Cancelled matchmaking for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("Error cancelling matchmaking:", error);
    throw error;
  }
}

// Clean up stale queue entries
export async function cleanupStaleQueue() {
  const queueRef = db.collection("tictactoe_queue");
  const staleTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
  
  try {
    const staleSnapshot = await queueRef
      .where("joinedAt", "<", staleTime)
      .where("status", "==", "waiting")
      .get();
      
    if (staleSnapshot.size > 0) {
      const batch = db.batch();
      staleSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${staleSnapshot.size} stale queue entries`);
    }
  } catch (error) {
    console.error("Error cleaning up stale queue:", error);
  }
}