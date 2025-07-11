import { doc, onSnapshot } from "firebase/firestore";
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
    // Prevent duplicate calls
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
   * Listen for match updates on the queue document in Firestore. 
   * Calls onMatch(roomId) when matched.
   */
  listenForMatch(userId: string, onMatch: (roomId: string) => void): () => void {
    // Clean up existing listener for this user
    this.cleanupListener(userId);
    
    const unsub = onSnapshot(
      doc(db, "tictactoe_queue", userId), 
      (docSnap) => {
        const data = docSnap.data();
        console.log(`Queue update for ${userId}:`, data);
        
        if (data?.status === "matched" && data.roomId) {
          console.log(`User ${userId} matched to room ${data.roomId}`);
          onMatch(data.roomId);
        }
      },
      (error) => {
        console.error("Error listening for match:", error);
      }
    );
    
    // Store the unsubscribe function
    this.listeners.set(userId, unsub);
    
    return () => {
      this.cleanupListener(userId);
    };
  }

  /**
   * Cancel matchmaking for a user
   */
  async cancelMatchmaking(userId: string): Promise<void> {
    // Stop any ongoing matchmaking
    this.matchmakingInProgress.delete(userId);
    
    // Clean up listener
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

  /**
   * Clean up a specific listener
   */
  private cleanupListener(userId: string): void {
    const existingUnsub = this.listeners.get(userId);
    if (existingUnsub) {
      existingUnsub();
      this.listeners.delete(userId);
    }
  }

  /**
   * Clean up all listeners (call this when component unmounts)
   */
  cleanup(): void {
    this.listeners.forEach((unsub) => unsub());
    this.listeners.clear();
    this.matchmakingInProgress.clear();
  }

  /**
   * Check if matchmaking is in progress for a user
   */
  isMatchmakingInProgress(userId: string): boolean {
    return this.matchmakingInProgress.has(userId);
  }
}

// Export a singleton instance
export const matchmakingService = new MatchmakingService();

// Also export the class for type checking
export default matchmakingService;