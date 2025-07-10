import { db } from "../utils/firestore.js";

export async function handleMatchmaking(userId, username) {
  // Add player to queue
  const queueRef = db.collection("tictactoe_queue");
  await queueRef.doc(userId).set({ userId, username, joinedAt: Date.now() });

  // Check for another player
  const snapshot = await queueRef.orderBy("joinedAt").limit(2).get();
  if (snapshot.size === 2) {
    const players = snapshot.docs.map(doc => doc.data());
    // Create game room
    const roomRef = await db.collection("rooms").add({
      game: "tictactoe",
      players: players.map(p => ({ userId: p.userId, username: p.username })),
      createdAt: Date.now(),
      status: "active"
    });
    // Notify both players (update their queue doc with roomId)
    await Promise.all(players.map(p =>
      queueRef.doc(p.userId).update({ roomId: roomRef.id, status: "matched" })
    ));
    return { matched: true, roomId: roomRef.id };
  }
  return { matched: false };
}
