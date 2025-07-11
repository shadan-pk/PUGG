// import { db } from "../utils/firestore.js";

// export async function handleMatchmaking(userId, username) {
//   const queueRef = db.collection("tictactoe_queue");
  
//   // Use a transaction to prevent race conditions
//   return await db.runTransaction(async (transaction) => {
//     // First, check if this user is already in queue
//     const userQueueDoc = await transaction.get(queueRef.doc(userId));
    
//     if (userQueueDoc.exists && userQueueDoc.data().status === "matched") {
//       // User is already matched, return the existing room
//       return { matched: true, roomId: userQueueDoc.data().roomId };
//     }
    
//     // Add/update player in queue
//     transaction.set(queueRef.doc(userId), { 
//       userId, 
//       username, 
//       joinedAt: Date.now(),
//       status: "waiting"
//     });
    
//     // Check for available players (excluding current user)
//     const snapshot = await transaction.get(
//       queueRef.where("status", "==", "waiting").orderBy("joinedAt").limit(2)
//     );
    
//     const availablePlayers = snapshot.docs
//       .map(doc => doc.data())
//       .filter(player => player.userId !== userId);
    
//     // If we have another player available, create a match
//     if (availablePlayers.length > 0) {
//       const opponent = availablePlayers[0];
//       const players = [
//         { userId, username },
//         { userId: opponent.userId, username: opponent.username }
//       ];
      
//       // Create game room
//       const roomRef = db.collection("rooms").doc(); // Generate ID first
//       transaction.set(roomRef, {
//         game: "tictactoe",
//         players: players,
//         createdAt: Date.now(),
//         status: "active",
//         currentPlayer: userId, // First player starts
//         board: Array(9).fill(null),
//         winner: null
//       });
      
//       // Mark both players as matched
//       transaction.update(queueRef.doc(userId), { 
//         roomId: roomRef.id, 
//         status: "matched" 
//       });
//       transaction.update(queueRef.doc(opponent.userId), { 
//         roomId: roomRef.id, 
//         status: "matched" 
//       });
      
//       // Schedule cleanup of queue docs (we'll do this outside the transaction)
//       setTimeout(async () => {
//         try {
//           await Promise.all([
//             queueRef.doc(userId).delete(),
//             queueRef.doc(opponent.userId).delete()
//           ]);
//         } catch (error) {
//           console.error("Error cleaning up queue:", error);
//         }
//       }, 1000);
      
//       return { matched: true, roomId: roomRef.id };
//     }
    
//     return { matched: false };
//   });
// }

// // Optional: Add a cleanup function to remove stale queue entries
// export async function cleanupStaleQueue() {
//   const queueRef = db.collection("tictactoe_queue");
//   const staleTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
  
//   const staleSnapshot = await queueRef
//     .where("joinedAt", "<", staleTime)
//     .where("status", "==", "waiting")
//     .get();
    
//   const batch = db.batch();
//   staleSnapshot.docs.forEach(doc => {
//     batch.delete(doc.ref);
//   });
  
//   if (staleSnapshot.size > 0) {
//     await batch.commit();
//     console.log(`Cleaned up ${staleSnapshot.size} stale queue entries`);
//   }
// }