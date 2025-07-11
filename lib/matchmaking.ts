import { db } from "@/lib/firebase";

export interface MatchmakingEntry {
  id?: string;
  userId: string;
  username: string;
  gameMode: string;
  status: "searching" | "waiting" | "matched" | "cancelled";
  createdAt?: any;
  matchedWith?: string;
  roomId?: string;
  joinedAt?: number;
  matchedAt?: number;
}

export class MatchmakingService {
  private matchmakingInProgress = new Set<string>();
  private listeners = new Map<string, () => void>();

  /**
   * Calls the backend matchmaking API. Returns { matched, roomId } or { matched: false }.
   */
  async joinMatchmaking(userId: string, username: string, gameMode: string): Promise<{ matched: boolean; roomId?: string }> {
    if (this.matchmakingInProgress.has(userId)) {
      console.log(`Matchmaking already in progress for user ${userId}`);
      return { matched: false };
    }
    this.matchmakingInProgress.add(userId);
    try {
      const res = await fetch("http://localhost:3001/matchmaking/tictactoe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username }),
      });
      if (!res.ok) {
        throw new Error(`Failed to join matchmaking: ${res.status} ${res.statusText}`);
      }
      const result = await res.json();
      console.log(`Matchmaking result for ${userId}:`, result);
      return result;
    } catch (error) {
      console.error("Matchmaking error:", error);
      throw error;
    } finally {
      this.matchmakingInProgress.delete(userId);
    }
  }

  /**
   * Polls the backend for match status. Calls onMatch(roomId) when matched.
   */
  listenForMatch(userId: string, onMatch: (roomId: string) => void): () => void {
    let stopped = false;
    const poll = async () => {
      while (!stopped) {
        try {
          const res = await fetch(`http://localhost:3001/matchmaking/tictactoe/status?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.matched && data.roomId) {
              onMatch(data.roomId);
              break;
            }
          }
        } catch (e) {
          console.error("Error polling for match status:", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // poll every second
      }
    };
    poll();
    return () => {
      stopped = true;
    };
  }

  /**
   * Cancel matchmaking for a user
   */
  async cancelMatchmaking(userId: string): Promise<void> {
    this.matchmakingInProgress.delete(userId);
    this.cleanupListener(userId);
    try {
      const res = await fetch("http://localhost:3001/matchmaking/tictactoe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        throw new Error(`Failed to cancel matchmaking: ${res.status} ${res.statusText}`);
      }
      console.log(`Matchmaking cancelled for user ${userId}`);
    } catch (error) {
      console.error("Error cancelling matchmaking:", error);
      throw error;
    }
  }

  private cleanupListener(userId: string): void {
    const existingUnsub = this.listeners.get(userId);
    if (existingUnsub) {
      existingUnsub();
      this.listeners.delete(userId);
    }
  }

  cleanup(): void {
    this.listeners.forEach((unsub) => unsub());
    this.listeners.clear();
    this.matchmakingInProgress.clear();
  }

  isMatchmakingInProgress(userId: string): boolean {
    return this.matchmakingInProgress.has(userId);
  }
}

export const matchmakingService = new MatchmakingService();
export default matchmakingService;