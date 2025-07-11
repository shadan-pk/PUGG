"use client"

import { useState, useEffect } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import AuthScreen from "@/components/auth-screen"
import UsernameSetup from "@/components/username-setup"
import GameLobby from "@/components/game-lobby"
import LoadingSpinner from "@/components/loading-spinner"
import { useToast } from "@/hooks/use-toast"

interface UserProfile {
  uid: string
  username: string
  displayName: string
  email: string
  photoURL: string
  stats: {
    gamesPlayed: number
    gamesWon: number
    winRate: number
    rank: string
    xp: number
    level: number
  }
  preferences: {
    gameMode: string
    notifications: boolean
  }
}

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("🔥 User authenticated:", firebaseUser.displayName)
        setUser(firebaseUser)
        setError(null)

        // Check if user has a profile
        try {
          console.log("📖 Loading user profile for:", firebaseUser.uid)
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))

          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile
            console.log("✅ User profile loaded:", profile.username)
            setUserProfile(profile)
            setNeedsUsername(false)
          } else {
            console.log("⚠️ User profile not found, needs username setup")
            setNeedsUsername(true)
          }
        } catch (error: any) {
          console.error("❌ Error loading user profile:", error)

          if (error.code === "permission-denied") {
            setError("Permission denied. Please check Firestore security rules.")
            toast({
              title: "🔒 Permission Error",
              description: "Please update your Firestore security rules to allow authenticated access.",
              variant: "destructive",
            })
          } else {
            setError(`Database error: ${error.message}`)
            toast({
              title: "Database Error",
              description: error.message,
              variant: "destructive",
            })
          }

          // Still allow username setup even if profile loading fails
          setNeedsUsername(true)
        }
      } else {
        console.log("🚪 User not authenticated")
        setUser(null)
        setUserProfile(null)
        setNeedsUsername(false)
        setError(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [toast])

  const handleAuthSuccess = (firebaseUser: any) => {
    setUser(firebaseUser)
    setNeedsUsername(true)
    setError(null)
  }

  const handleUsernameSet = async (username: string) => {
    if (user) {
      // Reload user profile
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile
          setUserProfile(profile)
          setNeedsUsername(false)
          setError(null)
        }
      } catch (error: any) {
        console.error("❌ Error loading updated profile:", error)
        setError(`Failed to load profile: ${error.message}`)
      }
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  // Show error state if there's a critical error
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-xl font-bold text-red-800 mb-2">🔒 Setup Required</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="text-sm text-red-700 bg-red-100 p-3 rounded">
              <p className="font-medium mb-2">To fix this:</p>
              <ol className="list-decimal list-inside space-y-1 text-left">
                <li>Go to Firebase Console</li>
                <li>Navigate to Firestore Database → Rules</li>
                <li>Update security rules to allow authenticated access</li>
                <li>Publish the changes</li>
              </ol>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />
  }

  if (needsUsername) {
    return <UsernameSetup user={user} onUsernameSet={handleUsernameSet} />
  }

  if (userProfile) {
    return <GameLobby userProfile={userProfile} />
  }

  return <LoadingSpinner />
}
