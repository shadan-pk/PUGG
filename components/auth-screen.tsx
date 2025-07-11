"use client"

import { useState } from "react"
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Gamepad2, Trophy, Users, Zap } from "lucide-react"

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.addScope("profile")
      provider.addScope("email")

      const result = await signInWithPopup(auth, provider)
      const user = result.user

      console.log("🎮 User signed in:", user.displayName)

      toast({
        title: "🎉 Welcome to the Arena!",
        description: `Signed in as ${user.displayName}`,
      })

      onAuthSuccess(user)
    } catch (error: any) {
      console.error("❌ Authentication error:", error)
      toast({
        title: "Authentication Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-full shadow-2xl">
              <Gamepad2 className="h-16 w-16 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">MINI ARENA</h1>
            <p className="text-xl text-gray-300">Battle Royale Mini Games</p>
            <div className="flex justify-center space-x-6 mt-4">
              <div className="text-center">
                <Users className="h-6 w-6 text-orange-400 mx-auto mb-1" />
                <p className="text-sm text-gray-400">Multiplayer</p>
              </div>
              <div className="text-center">
                <Trophy className="h-6 w-6 text-yellow-400 mx-auto mb-1" />
                <p className="text-sm text-gray-400">Ranked</p>
              </div>
              <div className="text-center">
                <Zap className="h-6 w-6 text-blue-400 mx-auto mb-1" />
                <p className="text-sm text-gray-400">Fast Match</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="bg-black/40 backdrop-blur-lg border-gray-700 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Enter the Arena</CardTitle>
            <CardDescription className="text-gray-300">
              Sign in with Google to start your gaming journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0"
            >
              {loading ? (
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </div>
              )}
            </Button>

            <div className="text-center text-sm text-gray-400">
              <p>By signing in, you agree to our Terms of Service</p>
              <p className="mt-1">and Privacy Policy</p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 text-center border border-gray-700">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-sm font-medium text-white">Multiple Game Modes</p>
            <p className="text-xs text-gray-400">Tic-Tac-Toe & More</p>
          </div>
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 text-center border border-gray-700">
            <div className="text-2xl mb-2">⚡</div>
            <p className="text-sm font-medium text-white">Fast Matchmaking</p>
            <p className="text-xs text-gray-400">Find opponents instantly</p>
          </div>
        </div>
      </div>
    </div>
  )
}
