import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

// TEMPORARY: Hard-coded Firebase configuration for testing
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY_HERE",
  authDomain: "tictactoe-bc835.firebaseapp.com",
  projectId: "tictactoe-bc835",
  storageBucket: "tictactoe-bc835.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_SENDER_ID_HERE",
  appId: "YOUR_ACTUAL_APP_ID_HERE",
  measurementId: "YOUR_ACTUAL_MEASUREMENT_ID_HERE",
}

console.log("🔥 Using hard-coded Firebase config for testing")

// Validate Firebase configuration - ONLY for Firestore (removed DATABASE_URL)
const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]

// Comment out this section temporarily
/*
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error("❌ Missing Firebase environment variables:", missingEnvVars)
  console.log("🎭 Running in demo mode - add Firebase config for real multiplayer!")
  console.log("📋 Create a .env.local file in your project root with:")
  missingEnvVars.forEach((envVar) => {
    console.log(`   ${envVar}=your_value_here`)
  })
}
*/

console.log("🔥 Firebase configuration status:", {
  projectId: firebaseConfig.projectId || "not configured",
  authDomain: firebaseConfig.authDomain || "not configured",
  configured: true, // Hardcoded config means it's configured
})

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const db = getFirestore(app)
export const auth = getAuth(app)

console.log("✅ Firebase initialized with Firestore")

// Export configuration status
export const isFirebaseConfigured = true // Hardcoded config means it's configured
export const isMockMode = !isFirebaseConfigured

// Enhanced mock database for development when Firebase is not available
function createMockDatabase() {
  const mockData: any = {}
  const listeners: any = {}

  // Mock database reference
  class MockDatabaseReference {
    constructor(private path: string) {}

    async push(data: any) {
      const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const fullPath = `${this.path}/${id}`
      mockData[fullPath] = { ...data, _id: id }

      console.log("📝 Mock push:", fullPath, data)

      // Trigger listeners for parent path
      this.triggerListeners(this.path)

      return {
        key: id,
        ref: new MockDatabaseReference(fullPath),
      }
    }

    async set(data: any) {
      mockData[this.path] = data
      console.log("📝 Mock set:", this.path, data)

      // Trigger listeners
      this.triggerListeners(this.path)

      return Promise.resolve()
    }

    async remove() {
      // Remove this path and all child paths
      Object.keys(mockData).forEach((key) => {
        if (key === this.path || key.startsWith(this.path + "/")) {
          delete mockData[key]
        }
      })

      console.log("🗑️ Mock remove:", this.path)

      // Trigger listeners
      this.triggerListeners(this.path)

      return Promise.resolve()
    }

    on(eventType: string, callback: Function, errorCallback?: Function) {
      console.log("👂 Mock listener added:", this.path, eventType)

      const listenerId = `${this.path}_${Date.now()}_${Math.random()}`

      if (!listeners[this.path]) {
        listeners[this.path] = []
      }

      listeners[this.path].push({
        id: listenerId,
        callback,
        errorCallback,
        eventType,
      })

      // Simulate initial data
      setTimeout(() => {
        this.triggerCallback(callback)
      }, 100)

      // Return unsubscribe function
      return () => {
        console.log("🔇 Mock unsubscribe:", this.path, listenerId)
        if (listeners[this.path]) {
          listeners[this.path] = listeners[this.path].filter((l: any) => l.id !== listenerId)
        }
      }
    }

    off(eventType?: string, callback?: Function) {
      console.log("🔇 Mock off:", this.path, eventType)
      if (listeners[this.path]) {
        if (callback) {
          listeners[this.path] = listeners[this.path].filter((l: any) => l.callback !== callback)
        } else {
          delete listeners[this.path]
        }
      }
    }

    private triggerListeners(path: string) {
      // Trigger listeners for this path and parent paths
      Object.keys(listeners).forEach((listenerPath) => {
        if (path === listenerPath || path.startsWith(listenerPath + "/") || listenerPath.startsWith(path + "/")) {
          listeners[listenerPath].forEach((listener: any) => {
            setTimeout(() => {
              this.triggerCallback(listener.callback, listenerPath)
            }, 10)
          })
        }
      })
    }

    private triggerCallback(callback: Function, targetPath?: string) {
      const pathToCheck = targetPath || this.path

      // Get data for this path
      const pathData: any = {}

      Object.keys(mockData).forEach((key) => {
        if (key === pathToCheck) {
          // Exact match
          return mockData[key]
        } else if (key.startsWith(pathToCheck + "/")) {
          // Child data
          const relativePath = key.replace(pathToCheck + "/", "")
          const pathParts = relativePath.split("/")

          if (pathParts.length === 1) {
            // Direct child
            pathData[pathParts[0]] = mockData[key]
          }
        }
      })

      const snapshot = {
        val: () => {
          if (mockData[pathToCheck]) {
            return mockData[pathToCheck]
          }
          return Object.keys(pathData).length > 0 ? pathData : null
        },
        key: pathToCheck.split("/").pop(),
        ref: new MockDatabaseReference(pathToCheck),
      }

      try {
        callback(snapshot)
      } catch (error) {
        console.error("Mock callback error:", error)
      }
    }

    // Add other Firebase methods that might be called
    child(path: string) {
      return new MockDatabaseReference(`${this.path}/${path}`)
    }

    parent() {
      const pathParts = this.path.split("/")
      pathParts.pop()
      return new MockDatabaseReference(pathParts.join("/"))
    }

    root() {
      return new MockDatabaseReference("")
    }

    toString() {
      return this.path
    }
  }

  return {
    ref: (path: string) => new MockDatabaseReference(path),
    goOffline: () => console.log("📴 Mock offline"),
    goOnline: () => console.log("📶 Mock online"),
  }
}

// Mock Firebase functions for when using mock database
export const mockFirebaseFunctions = {
  ref: (db: any, path: string) => db.ref(path),
  push: async (ref: any, data: any) => ref.push(data),
  set: async (ref: any, data: any) => ref.set(data),
  remove: async (ref: any) => ref.remove(),
  onValue: (ref: any, callback: Function, errorCallback?: Function) => ref.on("value", callback, errorCallback),
  off: (ref: any, eventType?: string, callback?: Function) => ref.off(eventType, callback),
}
