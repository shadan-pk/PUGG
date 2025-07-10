"use client"

import { useState, useEffect } from "react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import GameBoard from "@/components/game-board"
import { MatchmakingService } from "@/lib/matchmaking"
import { PresenceService, type UserPresence } from "@/lib/presence"
import { Users, Trophy, LogOut, Target, Crown, Zap, Clock, Star, X, Search } from "lucide-react"

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

interface GameLobbyProps {
  userProfile: UserProfile
}

const GAME_MODES = [
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    description: "Classic 3x3 strategy game",
    icon: "🎯",
    players: "1v1",
    duration: "2-5 min",
    difficulty: "Easy",
    available: true,
  },
  {
    id: "connect-four",
    name: "Connect Four",
    description: "Drop and connect four in a row",
    icon: "🔴",
    players: "1v1",
    duration: "3-8 min",
    difficulty: "Medium",
    available: false,
  },
  {
    id: "word-battle",
    name: "Word Battle",
    description: "Fast-paced word formation game",
    icon: "📝",
    players: "1v1",
    duration: "5-10 min",
    difficulty: "Hard",
    available: false,
  },
]

export default function GameLobby({ userProfile }: GameLobbyProps) {
  const [selectedMode, setSelectedMode] = useState("tic-tac-toe")
  const [matchmaking, setMatchmaking] = useState(false)
  const [currentMatch, setCurrentMatch] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
  const [matchmakingService] = useState(() => new MatchmakingService())
  const [presenceService] = useState(() => new PresenceService(userProfile.uid, userProfile.username))
  const [matchmakingId, setMatchmakingId] = useState<string | null>(null)
  const [matchmakingUnsubscribe, setMatchmakingUnsubscribe] = useState<(() => void) | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Set user online when component mounts
    presenceService.goOnline()

    // Listen to online users
    const unsubscribePresence = PresenceService.listenToOnlineUsers(setOnlineUsers)

    // Cleanup when component unmounts
    return () => {
      presenceService.goOffline()
      unsubscribePresence()
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
      }
    }
  }, [presenceService, matchmakingUnsubscribe])

  const handleStartMatch = async () => {
    setMatchmaking(true)

    try {
      console.log("🎮 Starting matchmaking for:", selectedMode)

      const result = await matchmakingService.joinMatchmaking(userProfile.uid, userProfile.username, selectedMode)

      if (result.matched && result.roomId) {
        // Immediate match
        setCurrentMatch(result.roomId)
        await presenceService.updateStatus("in-game", result.roomId)
        setMatchmaking(false)
        toast({
          title: "🎉 Match Found!",
          description: "Opponent found! Starting game...",
        })
      } else {
        // Waiting for opponent
        setMatchmakingId(userProfile.uid)
        toast({
          title: "🔍 Searching for Opponent",
          description: `Looking for players in ${GAME_MODES.find((m) => m.id === selectedMode)?.name}...`,
        })
        // Listen for match
        const unsubscribe = matchmakingService.listenForMatch(userProfile.uid, (roomId) => {
          setCurrentMatch(roomId)
          setMatchmaking(false)
          setMatchmakingId(null)
          presenceService.updateStatus("in-game", roomId)
          toast({
            title: "🎉 Match Found!",
            description: "Opponent found! Starting game...",
          })
          unsubscribe()
          setMatchmakingUnsubscribe(null)
        })
        setMatchmakingUnsubscribe(() => unsubscribe)
      }
    } catch (error: any) {
      console.error("❌ Matchmaking error:", error)
      setMatchmaking(false)
      setMatchmakingId(null)

      toast({
        title: "Matchmaking Failed",
        description: error.message || "Could not start matchmaking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCancelMatchmaking = async () => {
    if (matchmakingId) {
      await matchmakingService.cancelMatchmaking(matchmakingId)
      setMatchmakingId(null)
    }

    if (matchmakingUnsubscribe) {
      matchmakingUnsubscribe()
      setMatchmakingUnsubscribe(null)
    }

    setMatchmaking(false)

    toast({
      title: "❌ Matchmaking Cancelled",
      description: "You can start a new search anytime.",
    })
  }

  const handleLeaveGame = async () => {
    setCurrentMatch(null)
    await presenceService.updateStatus("online")

    toast({
      title: "👋 Left Game",
      description: "You're back in the lobby.",
    })
  }

  const handleLogout = async () => {
    try {
      // Cancel any active matchmaking
      if (matchmakingId) {
        await matchmakingService.cancelMatchmaking(matchmakingId)
      }

      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
      }

      await presenceService.goOffline()
      await signOut(auth)

      toast({
        title: "👋 See you later!",
        description: "You have been signed out successfully.",
      })
    } catch (error) {
      console.error("❌ Logout error:", error)
    }
  }

  if (currentMatch) {
    return <GameBoard roomId={currentMatch} user={userProfile} onLeave={handleLeaveGame} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">MINI ARENA</h1>
                <p className="text-gray-300 text-sm">Battle Royale Mini Games</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                <Users className="h-3 w-3 mr-1" />
                {onlineUsers.length} Online
              </Badge>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Player Info & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Player Profile */}
            <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <img
                    src={userProfile.photoURL || "/placeholder.svg?height=60&width=60"}
                    alt="Profile"
                    className="w-15 h-15 rounded-full border-2 border-orange-500"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-white">{userProfile.username}</h3>
                    <p className="text-gray-300 text-sm">{userProfile.displayName}</p>
                    <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30 mt-1">
                      <Crown className="h-3 w-3 mr-1" />
                      {userProfile.stats.rank}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Level</span>
                    <span className="text-white font-medium">{userProfile.stats.level}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">XP</span>
                    <span className="text-white font-medium">{userProfile.stats.xp}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Win Rate</span>
                    <span className="text-white font-medium">{userProfile.stats.winRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Online Players */}
            <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-400" />
                  Online Players ({onlineUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                {onlineUsers.map((user) => (
                  <div key={user.userId} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                    <span className="text-white text-sm">{user.username}</span>
                    <Badge
                      variant="secondary"
                      className={
                        user.status === "online" ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"
                      }
                    >
                      {user.status === "online" ? "🟢" : "🎮"}
                    </Badge>
                  </div>
                ))}
                {onlineUsers.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">No other players online</p>
                )}
              </CardContent>
            </Card>

            {/* Game Mode Selection */}
            <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Target className="h-5 w-5 mr-2 text-orange-400" />
                  Game Modes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {GAME_MODES.map((mode) => (
                  <div
                    key={mode.id}
                    onClick={() => mode.available && setSelectedMode(mode.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedMode === mode.id
                        ? "border-orange-500 bg-orange-500/10"
                        : mode.available
                          ? "border-gray-600 bg-gray-800/50 hover:border-gray-500"
                          : "border-gray-700 bg-gray-800/20 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{mode.icon}</span>
                        <span className="text-white font-medium">{mode.name}</span>
                      </div>
                      {!mode.available && (
                        <Badge variant="secondary" className="bg-gray-600 text-gray-300 text-xs">
                          Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mb-2">{mode.description}</p>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{mode.players}</span>
                      <span>{mode.duration}</span>
                      <span>{mode.difficulty}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Start Match Button */}
            {!matchmaking ? (
              <Button
                onClick={handleStartMatch}
                disabled={!GAME_MODES.find((m) => m.id === selectedMode)?.available}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0"
              >
                <div className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>FIND MATCH</span>
                </div>
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  disabled
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0"
                >
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Finding Match...</span>
                  </div>
                </Button>
                <Button
                  onClick={handleCancelMatchmaking}
                  variant="outline"
                  className="w-full bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Search
                </Button>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Trophy className="h-8 w-8 text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{userProfile.stats.gamesWon}</p>
                      <p className="text-gray-400 text-sm">Wins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{userProfile.stats.gamesPlayed}</p>
                      <p className="text-gray-400 text-sm">Games Played</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Star className="h-8 w-8 text-purple-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{userProfile.stats.xp}</p>
                      <p className="text-gray-400 text-sm">Experience</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Featured Content */}
            <Card className="bg-black/40 backdrop-blur-lg border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">🎮 Matchmaking Center</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-2xl font-bold text-white">Ready for Battle?</h3>
                  <p className="text-gray-300 max-w-md mx-auto">
                    Advanced matchmaking system will pair you with opponents of similar skill level. Find your match and
                    climb the ranks!
                  </p>

                  {/* Matchmaking Status */}
                  {matchmaking && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-6">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                        <span className="text-blue-300 font-medium">Searching for opponent...</span>
                      </div>
                      <p className="text-blue-200 text-sm mt-2">
                        Game mode: {GAME_MODES.find((m) => m.id === selectedMode)?.name}
                      </p>
                      <p className="text-blue-200 text-xs mt-1">
                        {onlineUsers.filter((u) => u.status === "online").length} players available
                      </p>
                    </div>
                  )}

                  {/* Success Message */}
                  {!matchmaking && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mt-6">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-green-300 font-medium">✅ Matchmaking System Active</span>
                      </div>
                      <p className="text-green-200 text-sm mt-2">
                        Firestore index is working! Advanced matchmaking enabled.
                      </p>
                    </div>
                  )}

                  {/* Coming Soon Features */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <Clock className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 font-medium">Ranked Matches</p>
                      <p className="text-xs text-gray-500">Skill-based matching</p>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <Trophy className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 font-medium">Leaderboards</p>
                      <p className="text-xs text-gray-500">Global rankings</p>
                    </div>
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <Users className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 font-medium">Tournaments</p>
                      <p className="text-xs text-gray-500">Competitive events</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
