import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface MatchmakingEntry {
  id?: string
  userId: string
  username: string
  gameMode: string
  status: "searching" | "matched" | "cancelled"
  createdAt: any
  matchedWith?: string
  roomId?: string
}

export class MatchmakingService {
  private unsubscribe: (() => void) | null = null

  /**
   * Join matchmaking. Returns the matchmaking document id to listen for updates.
   * Only one matchmaking document is created per player. When a match is found, the first player's document is updated.
   */
  /**
   * PUBG-like matchmaking: players join a pool, and when enough are present, all are matched at once.
   * Each player listens to their own matchmaking doc for updates.
   */
  async joinMatchmaking(userId: string, username: string, gameMode: string): Promise<string> {
    console.log("🔍 Joining matchmaking (wait for pool):", { userId, username, gameMode })

    // Add this player to the matchmaking pool
    const docRef = await addDoc(collection(db, "matchmaking"), {
      userId,
      username,
      gameMode,
      status: "searching",
      createdAt: serverTimestamp(),
    })

    // Check if there is another player already waiting in the pool (not this user)
    const poolQuery = query(
      collection(db, "matchmaking"),
      where("gameMode", "==", gameMode),
      where("status", "==", "searching"),
      orderBy("createdAt", "asc"),
      limit(2),
    )
    const poolSnapshot = await getDocs(poolQuery)
    // Only match if there are exactly 2 players (including this one)
    if (poolSnapshot.size === 2) {
      const players = poolSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as MatchmakingEntry),
      }))
      // Only proceed if both are still searching
      if (players.every((p) => p.status === "searching")) {
        // Create a game room for both
        const roomId = await this.createGameRoom(
          { userId: players[0].userId, username: players[0].username },
          { userId: players[1].userId, username: players[1].username },
          gameMode,
        )
        // Update both players' matchmaking entries to matched and set roomId
        await Promise.all(
          players.map((player) =>
            updateDoc(doc(db, "matchmaking", player.id), {
              status: "matched",
              matchedWith: players.find((p) => p.id !== player.id)?.userId,
              roomId,
            })
          )
        )
        console.log("🎮 Match found! Players:", players.map((p) => p.username).join(", "))
      }
    }

    // Return this player's matchmaking doc id (client should listen for status: 'matched' and roomId)
    return docRef.id
  }

  private async createGameRoom(
    player1: { userId: string; username: string },
    player2: { userId: string; username: string },
    gameMode: string,
  ): Promise<string> {
    console.log("🏠 Creating game room for:", player1.username, "vs", player2.username)

    const roomData = {
      gameState: {
        board: Array(9).fill(null),
        currentPlayer: "X" as const,
        winner: null,
        playerX: player1.userId,
        playerO: player2.userId,
        moves: 0,
      },
      players: {
        [player1.userId]: {
          name: player1.username,
          email: `${player1.userId}@player.local`,
        },
        [player2.userId]: {
          name: player2.username,
          email: `${player2.userId}@player.local`,
        },
      },
      status: "active",
      gameMode,
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
    }

    const roomRef = await addDoc(collection(db, "rooms"), roomData)
    console.log("✅ Game room created:", roomRef.id)

    return roomRef.id
  }

  /**
   * Listen for match updates on a matchmaking document. Calls onMatch(roomId) when matched.
   */
  listenForMatch(matchmakingId: string, onMatch: (roomId: string) => void): () => void {
    console.log("👂 Listening for match:", matchmakingId)
    this.unsubscribe = onSnapshot(doc(db, "matchmaking", matchmakingId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as MatchmakingEntry
        console.log("📡 Matchmaking update:", data)
        if (data.status === "matched" && data.roomId) {
          console.log("🎉 Match found! Room:", data.roomId)
          onMatch(data.roomId)
        }
      }
    })
    return () => {
      if (this.unsubscribe) {
        this.unsubscribe()
        this.unsubscribe = null
      }
    }
  }
  /**
   * Call this after the game is finished to remove the matchmaking document.
   */
  async removeMatchmakingEntry(matchmakingId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "matchmaking", matchmakingId))
      console.log("✅ Matchmaking entry removed")
    } catch (error) {
      console.error("❌ Error removing matchmaking entry:", error)
    }
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  async cancelMatchmaking(matchmakingId: string): Promise<void> {
    console.log("❌ Cancelling matchmaking:", matchmakingId)

    try {
      await deleteDoc(doc(db, "matchmaking", matchmakingId))
      console.log("✅ Matchmaking cancelled")
    } catch (error) {
      console.error("❌ Error cancelling matchmaking:", error)
    }

    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  // Clean up old matchmaking entries (optional utility)
  async cleanupOldEntries(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const oldEntriesQuery = query(
      collection(db, "matchmaking"),
      where("createdAt", "<", fiveMinutesAgo),
      where("status", "==", "searching"),
    )

    const oldEntries = await getDocs(oldEntriesQuery)

    const deletePromises = oldEntries.docs.map((doc) => deleteDoc(doc.ref))
    await Promise.all(deletePromises)

    console.log(`🧹 Cleaned up ${oldEntries.docs.length} old matchmaking entries`)
  }
}


