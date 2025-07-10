"use client"

import type React from "react"

import { useState } from "react"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { User, AlertTriangle, CheckCircle } from "lucide-react"

interface UsernameSetupProps {
  user: any
  onUsernameSet: (username: string) => void
}

export default function UsernameSetup({ user, onUsernameSet }: UsernameSetupProps) {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const { toast } = useToast()

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (usernameToCheck.length < 3) {
      setIsAvailable(null)
      return
    }

    setChecking(true)
    try {
      const usernameDoc = await getDoc(doc(db, "usernames", usernameToCheck.toLowerCase()))
      setIsAvailable(!usernameDoc.exists())
    } catch (error) {
      console.error("Error checking username:", error)
      setIsAvailable(null)
    } finally {
      setChecking(false)
    }
  }

  const handleUsernameChange = (value: string) => {
    // Only allow alphanumeric characters and underscores
    const cleanValue = value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16)
    setUsername(cleanValue)

    // Debounce username check
    setTimeout(() => {
      if (cleanValue === username) {
        checkUsernameAvailability(cleanValue)
      }
    }, 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username || username.length < 3) {
      toast({
        title: "Invalid Username",
        description: "Username must be at least 3 characters long",
        variant: "destructive",
      })
      return
    }

    if (isAvailable === false) {
      toast({
        title: "Username Taken",
        description: "Please choose a different username",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Create user profile
      const userProfile = {
        uid: user.uid,
        username: username,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date(),
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          winRate: 0,
          rank: "Rookie",
          xp: 0,
          level: 1,
        },
        preferences: {
          gameMode: "tic-tac-toe",
          notifications: true,
        },
      }

      // Save user profile
      await setDoc(doc(db, "users", user.uid), userProfile)

      // Reserve username
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        uid: user.uid,
        username: username,
        createdAt: new Date(),
      })

      console.log("✅ User profile created:", userProfile)

      toast({
        title: "🎉 Welcome to the Arena!",
        description: `Username "${username}" has been set successfully!`,
      })

      onUsernameSet(username)
    } catch (error) {
      console.error("❌ Error creating profile:", error)
      toast({
        title: "Setup Failed",
        description: "Failed to create your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* User Info */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img
              src={user.photoURL || "/placeholder.svg?height=80&width=80"}
              alt="Profile"
              className="w-20 h-20 rounded-full border-4 border-orange-500 shadow-lg"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome, {user.displayName}!</h1>
            <p className="text-gray-300">Choose your battle username</p>
          </div>
        </div>

        {/* Username Setup Card */}
        <Card className="bg-black/40 backdrop-blur-lg border-gray-700 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Set Your Username</CardTitle>
            <CardDescription className="text-gray-300">
              This will be your permanent identity in the arena
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="pl-10 h-12 bg-black/20 border-gray-600 text-white placeholder-gray-400"
                    maxLength={16}
                    required
                  />
                  {checking && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                    </div>
                  )}
                  {!checking && isAvailable === true && (
                    <CheckCircle className="absolute right-3 top-3 h-5 w-5 text-green-500" />
                  )}
                  {!checking && isAvailable === false && (
                    <AlertTriangle className="absolute right-3 top-3 h-5 w-5 text-red-500" />
                  )}
                </div>

                {/* Username Status */}
                <div className="text-sm">
                  {username.length > 0 && username.length < 3 && (
                    <p className="text-yellow-400">Username must be at least 3 characters</p>
                  )}
                  {isAvailable === true && <p className="text-green-400">✅ Username is available!</p>}
                  {isAvailable === false && <p className="text-red-400">❌ Username is already taken</p>}
                  {checking && <p className="text-gray-400">Checking availability...</p>}
                </div>

                <div className="text-xs text-gray-400">
                  <p>• 3-16 characters</p>
                  <p>• Letters, numbers, and underscores only</p>
                  <p>• Cannot be changed later</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !username || username.length < 3 || isAvailable === false}
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Creating Profile...</span>
                  </div>
                ) : (
                  "Enter the Arena"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <p className="text-yellow-200 text-sm font-medium">Your username cannot be changed once set!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
