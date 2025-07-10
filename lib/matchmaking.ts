
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MatchmakingEntry {
  id?: string;
  userId: string;
  username: string;
  gameMode: string;
  status: "searching" | "matched" | "cancelled";
  createdAt?: any;
  matchedWith?: string;
  roomId?: string;
}

export class MatchmakingService {
  /**
   * Calls the backend matchmaking API. Returns { matched, roomId } or { matched: false }.
   */
  async joinMatchmaking(userId: string, username: string, gameMode: string): Promise<{ matched: boolean; roomId?: string }> {
    const res = await fetch("http://localhost:3001/matchmaking/tictactoe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username }),
    });
    if (!res.ok) throw new Error("Failed to join matchmaking");
    return await res.json();
  }

  /**
   * Listen for match updates on the queue document in Firestore. Calls onMatch(roomId) when matched.
   */
  listenForMatch(userId: string, onMatch: (roomId: string) => void): () => void {
    const unsub = onSnapshot(doc(db, "tictactoe_queue", userId), (docSnap) => {
      const data = docSnap.data();
      if (data?.status === "matched" && data.roomId) {
        onMatch(data.roomId);
      }
    });
    return unsub;
  }

  async cancelMatchmaking(userId: string): Promise<void> {
    // Remove from queue
    const res = await fetch("http://localhost:3001/matchmaking/tictactoe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to cancel matchmaking");
    return;
  }
}


