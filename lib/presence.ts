import { doc, setDoc, deleteDoc, serverTimestamp, collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface UserPresence {
  userId: string
  username: string
  status: "online" | "offline" | "in-game"
  lastSeen: any
  currentRoom?: string
}

export class PresenceService {
  private userId: string
  private username: string
  private unsubscribePresence: (() => void) | null = null

  constructor(userId: string, username: string) {
    this.userId = userId
    this.username = username
  }

  async goOnline(): Promise<void> {
    console.log("🟢 Setting user online:", this.username)

    const presenceData: UserPresence = {
      userId: this.userId,
      username: this.username,
      status: "online",
      lastSeen: serverTimestamp(),
    }

    // Set user as online
    await setDoc(doc(db, "presence", this.userId), presenceData)

    // Set up offline detection
    this.setupOfflineDetection()
  }

  async goOffline(): Promise<void> {
    console.log("🔴 Setting user offline:", this.username)

    try {
      await deleteDoc(doc(db, "presence", this.userId))
    } catch (error) {
      console.error("Error setting offline:", error)
    }

    if (this.unsubscribePresence) {
      this.unsubscribePresence()
      this.unsubscribePresence = null
    }
  }

  async updateStatus(status: "online" | "in-game", roomId?: string): Promise<void> {
    console.log("📊 Updating status:", status, roomId)

    const updateData: Partial<UserPresence> = {
      status,
      lastSeen: serverTimestamp(),
    }

    if (roomId) {
      updateData.currentRoom = roomId
    }

    await setDoc(doc(db, "presence", this.userId), updateData, { merge: true })
  }

  private setupOfflineDetection(): void {
    // Set up automatic offline when user disconnects
    const presenceRef = doc(db, "presence", this.userId)

    // Note: onDisconnect is not available in Firestore web SDK
    // We'll use visibility API and beforeunload events instead

    const handleOffline = () => {
      this.goOffline()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs or minimized
        this.updateStatus("online") // Keep online but update timestamp
      } else {
        // User came back
        this.goOnline()
      }
    }

    // Listen for page unload
    window.addEventListener("beforeunload", handleOffline)
    window.addEventListener("unload", handleOffline)

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Heartbeat to keep presence updated
    const heartbeat = setInterval(() => {
      if (!document.hidden) {
        this.updateStatus("online")
      }
    }, 30000) // Update every 30 seconds

    // Store cleanup function
    this.unsubscribePresence = () => {
      window.removeEventListener("beforeunload", handleOffline)
      window.removeEventListener("unload", handleOffline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(heartbeat)
    }
  }

  static listenToOnlineUsers(callback: (users: UserPresence[]) => void): () => void {
    console.log("👥 Listening to online users")

    const presenceQuery = query(collection(db, "presence"), where("status", "in", ["online", "in-game"]))

    return onSnapshot(presenceQuery, (snapshot) => {
      const onlineUsers = snapshot.docs.map((doc) => doc.data() as UserPresence)
      console.log("👥 Online users updated:", onlineUsers.length)
      callback(onlineUsers)
    })
  }
}
