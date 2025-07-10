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

  async joinMatchmaking(userId: string, username: string, gameMode: string): Promise<string> {
    console.log("🔍 Joining matchmaking:", { userId, username, gameMode })

    // Now we can use the full query with the index you created
    const matchmakingQuery = query(
      collection(db, "matchmaking"),
      where("gameMode", "==", gameMode),
      where("status", "==", "searching"),
      orderBy("createdAt", "asc"),
      limit(5),
    )

    const existingMatches = await getDocs(matchmakingQuery)

    // Filter out current user client-side (since we can't use != in compound queries)
    const availableMatches = existingMatches.docs.filter((doc) => {
      const data = doc.data() as MatchmakingEntry
      return data.userId !== userId
    })

    if (availableMatches.length > 0) {
      // Found a match! Create a game room
      const opponentDoc = availableMatches[0]
      const opponent = opponentDoc.data() as MatchmakingEntry

      console.log("🎯 Found opponent:", opponent.username)

      // Create game room
      const roomId = await this.createGameRoom(
        { userId, username },
        { userId: opponent.userId, username: opponent.username },
        gameMode,
      )

      // Update opponent's matchmaking entry
      await updateDoc(doc(db, "matchmaking", opponentDoc.id), {
        status: "matched",
        matchedWith: userId,
        roomId: roomId,
      })

      // Create our matchmaking entry as matched
      await addDoc(collection(db, "matchmaking"), {
        userId,
        username,
        gameMode,
        status: "matched",
        createdAt: serverTimestamp(),
        matchedWith: opponent.userId,
        roomId: roomId,
      })

      return roomId
    } else {
      // No match found, add to queue
      console.log("⏳ No opponent found, joining queue...")

      const docRef = await addDoc(collection(db, "matchmaking"), {
        userId,
        username,
        gameMode,
        status: "searching",
        createdAt: serverTimestamp(),
      })

      return docRef.id // Return matchmaking ID to listen for matches
    }
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
