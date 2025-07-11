"use client"

import { useState, useEffect, useCallback } from "react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import GenericGameBoard from "@/components/game-board-generic"
import { TicTacToeRenderer } from "@/components/game-renderers/tictactoe-renderer"
import { ConnectFourRenderer } from "@/components/game-renderers/connect-four-renderer"
import { matchmakingService } from "@/lib/matchmaking" // Use singleton instance
import { PresenceService, type UserPresence } from "@/lib/presence"
import { Users, Trophy, LogOut, Target, Crown, Zap, Clock, Star, X, Search, AlertCircle } from "lucide-react"

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

interface AvailableGame {
  type: string
  name: string
  minPlayers: number
  maxPlayers: number
}

interface GameLobbyProps {
  userProfile: UserProfile
}

export default function GameLobby({ userProfile }: GameLobbyProps) {
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([])
  const [selectedGame, setSelectedGame] = useState<string>("")
  const [matchmaking, setMatchmaking] = useState(false)
  const [currentMatch, setCurrentMatch] = useState<string | null>(null)
  const [lastMatchmakingStart, setLastMatchmakingStart] = useState<number>(0)
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
  const [presenceService] = useState(() => new PresenceService(userProfile.uid, userProfile.username))
  const [matchmakingUnsubscribe, setMatchmakingUnsubscribe] = useState<(() => void) | null>(null)
  const [resultScreenCooldown, setResultScreenCooldown] = useState<number>(0)
  const [isOnResultScreen, setIsOnResultScreen] = useState(false)
  const { toast } = useToast()

  // Check if user can enter matchmaking
  const canEnterMatchmaking = !isOnResultScreen && resultScreenCooldown === 0

  // Fetch available games from backend
  useEffect(() => {
    const fetchAvailableGames = async () => {
      try {
        const response = await fetch('http://localhost:3001/games');
        if (response.ok) {
          const games = await response.json();
          setAvailableGames(games);
          // Set first available game as default
          if (games.length > 0 && !selectedGame) {
            setSelectedGame(games[0].type);
          }
        } else {
          console.error('Failed to fetch available games');
        }
      } catch (error) {
        console.error('Error fetching available games:', error);
      }
    };

    fetchAvailableGames();
  }, [selectedGame]);

  // Handle match found callback
  const handleMatchFound = useCallback((roomId: string) => {
    console.log(`🎉 Match found! Room ID: ${roomId}`)
    console.log(`🔍 Previous currentMatch: ${currentMatch}`)
    console.log(`⏰ Last matchmaking start: ${lastMatchmakingStart}`)
    
    // Extract timestamp from room ID to validate it's a fresh match
    const parts = roomId.split('-');
    if (parts.length >= 2) {
      const roomTimestamp = parseInt(parts[parts.length - 2]);
      const timeDiff = roomTimestamp - lastMatchmakingStart;
      
      // If the room was created more than 10 seconds before we started matchmaking, ignore it
      if (timeDiff < -10000) {
        console.log(`⚠️ Ignoring old room ID: ${roomId} (created ${timeDiff}ms before matchmaking start)`);
        return;
      }
    }
    
    setCurrentMatch(roomId)
    setMatchmaking(false)
    setIsOnResultScreen(false) // Reset result screen state
    setResultScreenCooldown(0) // Reset cooldown
    presenceService.updateStatus("in-game", roomId)
    
    // Clean up matchmaking listener
    if (matchmakingUnsubscribe) {
      matchmakingUnsubscribe()
      setMatchmakingUnsubscribe(null)
    }
    
    toast({
      title: "🎉 Match Found!",
      description: "Opponent found! Starting game...",
    })
  }, [presenceService, matchmakingUnsubscribe, toast, currentMatch, lastMatchmakingStart])

  useEffect(() => {
    // Set user online when component mounts
    presenceService.goOnline()

    // Listen to online users
    const unsubscribePresence = PresenceService.listenToOnlineUsers(setOnlineUsers)

    // Cleanup when component unmounts
    return () => {
      presenceService.goOffline()
      unsubscribePresence()
      
      // Clean up matchmaking
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
      }
      
      // Clean up matchmaking service
      if (matchmakingService && typeof matchmakingService.cleanup === 'function') {
        matchmakingService.cleanup()
      }
    }
  }, [presenceService, matchmakingUnsubscribe])

  // Handle result screen state changes
  const handleResultScreenEnter = useCallback(() => {
    console.log("🎭 User entered result screen")
    setIsOnResultScreen(true)
  }, [])

  const handleResultScreenLeave = useCallback(() => {
    console.log("🎭 User left result screen, starting cooldown")
    setIsOnResultScreen(false)
    setResultScreenCooldown(5) // 5 second cooldown
    
    // Start cooldown timer
    const cooldownInterval = setInterval(() => {
      setResultScreenCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleStartMatch = async () => {
    // Prevent matchmaking if on result screen or in cooldown
    if (!canEnterMatchmaking) {
      if (isOnResultScreen) {
        toast({
          title: "⚠️ Still on Result Screen",
          description: "Please wait for the result screen to finish before starting a new match.",
          variant: "destructive",
        })
      } else if (resultScreenCooldown > 0) {
        toast({
          title: "⏳ Cooldown Active",
          description: `Please wait ${resultScreenCooldown} seconds before starting a new match.`,
          variant: "destructive",
        })
      }
      return
    }

    // Prevent multiple matchmaking attempts
    if (matchmaking || matchmakingService.isMatchmakingInProgress(userProfile.uid)) {
      console.log("⚠️ Matchmaking already in progress")
      return
    }

    if (!selectedGame) {
      toast({
        title: "No Game Selected",
        description: "Please select a game to play.",
        variant: "destructive",
      })
      return
    }

    setMatchmaking(true)
    setLastMatchmakingStart(Date.now())

    try {
      console.log("🎮 Starting matchmaking for:", selectedGame)

      // Start listening for match updates first
      const unsubscribe = matchmakingService.listenForMatch(userProfile.uid, selectedGame, handleMatchFound)
      setMatchmakingUnsubscribe(() => unsubscribe)

      // Then call the matchmaking API
      const result = await matchmakingService.joinMatchmaking(userProfile.uid, userProfile.username, selectedGame)

      if (result.matched && result.roomId) {
        // Immediate match found
        handleMatchFound(result.roomId)
      } else {
        // Waiting for opponent
        const gameName = availableGames.find(g => g.type === selectedGame)?.name || selectedGame;
        toast({
          title: "🔍 Searching for Opponent",
          description: `Looking for players in ${gameName}...`,
        })
        // Keep matchmaking state true and listener active
      }
    } catch (error: any) {
      console.error("❌ Matchmaking error:", error)
      setMatchmaking(false)
      
      // Clean up listener on error
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
        setMatchmakingUnsubscribe(null)
      }

      toast({
        title: "Matchmaking Failed",
        description: error.message || "Could not start matchmaking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCancelMatchmaking = async () => {
    try {
      // Cancel matchmaking on backend
      await matchmakingService.cancelMatchmaking(userProfile.uid, selectedGame)
      
      // Clean up listener
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
        setMatchmakingUnsubscribe(null)
      }

      setMatchmaking(false)

      toast({
        title: "❌ Matchmaking Cancelled",
        description: "You can start a new search anytime.",
      })
    } catch (error) {
      console.error("❌ Error cancelling matchmaking:", error)
      // Still update UI state even if backend call fails
      setMatchmaking(false)
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
        setMatchmakingUnsubscribe(null)
      }
    }
  }

  const handleLeaveGame = async () => {
    console.log(`🚪 Leaving game, clearing currentMatch: ${currentMatch}`)
    
    // Reset result screen state when leaving game
    setIsOnResultScreen(false)
    setResultScreenCooldown(0)
    
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
      if (matchmaking) {
        await matchmakingService.cancelMatchmaking(userProfile.uid, selectedGame)
      }

      // Clean up listener
      if (matchmakingUnsubscribe) {
        matchmakingUnsubscribe()
      }

      // Clean up services
      if (matchmakingService && typeof matchmakingService.cleanup === 'function') {
        matchmakingService.cleanup()
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
    console.log(`🎮 Rendering game board for currentMatch: ${currentMatch}`);
    // Extract game type from room ID (format: gameType-timestamp-random)
    console.log("🔍 Room ID:", currentMatch);
    
    // Handle multi-word game types like "connect-four"
    // Split by '-' and take all parts except the last two (timestamp and random)
    const parts = currentMatch.split('-');
    const gameType = parts.slice(0, -2).join('-');
    console.log("🎮 Extracted game type:", gameType);
    
    // Get the appropriate renderer based on game type
    let gameRenderer;
    switch (gameType) {
      case 'tictactoe':
        gameRenderer = new TicTacToeRenderer();
        break;
      case 'connect-four':
        gameRenderer = new ConnectFourRenderer();
        break;
      default:
        console.warn("⚠️ Unknown game type:", gameType, "falling back to Tic Tac Toe renderer");
        // Fallback to Tic Tac Toe renderer for unknown game types
        gameRenderer = new TicTacToeRenderer();
        break;
    }
    
    return (
      <GenericGameBoard 
        gameType={gameType}
        roomId={currentMatch} 
        user={userProfile} 
        onLeave={handleLeaveGame}
        onResultScreenEnter={handleResultScreenEnter}
        onResultScreenLeave={handleResultScreenLeave}
        gameRenderer={gameRenderer}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur supports-[backdrop-filter]:bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Game Arena
                </h1>
                <p className="text-slate-400 text-sm">Choose your battle</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-slate-800/50 rounded-lg px-3 py-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-slate-300">
                  {onlineUsers.length} online
                </span>
              </div>
              
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Game Selection */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Choose Your Game
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableGames.map((game) => (
                  <div
                    key={game.type}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      selectedGame === game.type
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                    }`}
                    onClick={() => setSelectedGame(game.type)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{game.name.charAt(0)}</div>
                        <div>
                          <h3 className="font-semibold text-slate-100">{game.name}</h3>
                          <p className="text-sm text-slate-400">
                            {game.minPlayers}v{game.maxPlayers}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {game.minPlayers}v{game.maxPlayers}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Player Info & Controls */}
          <div className="space-y-6">
            {/* Player Card */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Player Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {userProfile.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100">{userProfile.username}</h3>
                    <p className="text-sm text-slate-400">Level {userProfile.stats.level}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400">Games Played</div>
                    <div className="text-slate-100 font-semibold">{userProfile.stats.gamesPlayed}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400">Win Rate</div>
                    <div className="text-slate-100 font-semibold">{userProfile.stats.winRate}%</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400">Rank</div>
                    <div className="text-slate-100 font-semibold">{userProfile.stats.rank}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400">XP</div>
                    <div className="text-slate-100 font-semibold">{userProfile.stats.xp}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matchmaking Controls */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Quick Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Show cooldown warning if active */}
                {resultScreenCooldown > 0 && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center space-x-2 text-amber-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Cooldown: {resultScreenCooldown}s remaining
                      </span>
                    </div>
                  </div>
                )}

                {/* Show result screen warning if active */}
                {isOnResultScreen && (
                  <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Please wait for result screen to finish
                      </span>
                    </div>
                  </div>
                )}

                {!matchmaking ? (
                  <Button
                    onClick={handleStartMatch}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3"
                    disabled={!selectedGame || !canEnterMatchmaking}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {!canEnterMatchmaking ? "Matchmaking Unavailable" : "Find Match"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-2 text-slate-300">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span>Searching for opponent...</span>
                    </div>
                    <Button
                      onClick={handleCancelMatchmaking}
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Search
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Online Players */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Online Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {onlineUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between py-2 px-3 bg-slate-800/30 rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-sm text-slate-300">{user.username}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {user.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}