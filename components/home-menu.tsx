"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Gamepad2, Mail, Play, Sparkles } from "lucide-react"

interface HomeMenuUser {
  uid: string
  email: string
  displayName: string
}

interface HomeMenuProps {
  onLogin: (user: HomeMenuUser) => void
}

export default function HomeMenu({ onLogin }: HomeMenuProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleQuickPlay = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    // Generate a unique user ID
    const userId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const user: HomeMenuUser = {
      uid: userId,
      displayName: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, "")}@player.local`,
    }

    // Simulate loading for better UX
    setTimeout(() => {
      setLoading(false)
      onLogin(user)
      toast({
        title: "🎮 Welcome!",
        description: `Ready to play, ${user.displayName}!`,
      })
    }, 1000)
  }

  const handleGuestPlay = () => {
    const guestNames = [
      "Anonymous Player",
      "Mystery Gamer",
      "Secret Agent",
      "Ninja Player",
      "Ghost Player",
      "Shadow Warrior",
      "Silent Hero",
      "Unknown Champion",
    ]
    const randomName = guestNames[Math.floor(Math.random() * guestNames.length)]

    setLoading(true)

    const userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const user: HomeMenuUser = {
      uid: userId,
      displayName: randomName,
      email: `${randomName.toLowerCase().replace(/\s+/g, "")}@guest.local`,
    }

    setTimeout(() => {
      setLoading(false)
      onLogin(user)
      toast({
        title: "🎭 Welcome Guest!",
        description: `Playing as ${user.displayName}`,
      })
    }, 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-lg">
              <Gamepad2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Tic-Tac-Toe Online</h1>
            <p className="text-gray-600 dark:text-gray-400">Play with friends around the world</p>
            <Badge variant="secondary" className="mt-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Real-time Multiplayer
            </Badge>
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join the Game</CardTitle>
            <CardDescription>Enter your details to start playing online tic-tac-toe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Your Name
              </Label>
              <div className="relative">
                <Gamepad2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12"
                  maxLength={20}
                />
              </div>
            </div>

            {/* Email Input (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-gray-400">(optional)</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* Play Button */}
            <Button
              onClick={handleQuickPlay}
              disabled={loading}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Joining Game...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Play className="h-5 w-5" />
                  <span>Start Playing</span>
                </div>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Guest Play Button */}
            <Button
              onClick={handleGuestPlay}
              disabled={loading}
              variant="outline"
              className="w-full h-12 text-lg font-semibold bg-transparent"
            >
              {loading ? (
                "Loading..."
              ) : (
                <div className="flex items-center space-x-2">
                  <Gamepad2 className="h-5 w-5" />
                  <span>Play as Guest</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white/60 rounded-lg backdrop-blur-sm">
            <div className="text-2xl mb-2">🚀</div>
            <p className="text-sm font-medium text-gray-700">Real-time</p>
            <p className="text-xs text-gray-500">Live gameplay</p>
          </div>
          <div className="p-4 bg-white/60 rounded-lg backdrop-blur-sm">
            <div className="text-2xl mb-2">🌐</div>
            <p className="text-sm font-medium text-gray-700">Online</p>
            <p className="text-xs text-gray-500">Play anywhere</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Create rooms • Share with friends • Play together</p>
        </div>
      </div>
    </div>
  )
}
