"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Users, Home, Clock } from "lucide-react"

interface GameState {
  board: (string | null)[]
  currentPlayer: "X" | "O"
  winner: string | null
  playerX: string
  playerO: string | null
  moves: number
}

interface Player {
  name: string
  email?: string
}

interface MockUser {
  uid: string
  email: string
  displayName: string
}

interface RoomData {
  gameState: GameState
  players: { [key: string]: Player }
  status: string
  roomId: string
}

interface ResultScreenProps {
  roomData: RoomData
  user: MockUser
  onBackToLobby: () => void
}

export default function ResultScreen({ roomData, user, onBackToLobby }: ResultScreenProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [timeLeft, setTimeLeft] = useState(5) // 5 seconds countdown
  const { gameState, players, roomId } = roomData

  const playerXName = players[gameState.playerX]?.name || "Player X"
  const playerOName = players[gameState.playerO!]?.name || "Player O"
  const isPlayerX = gameState.playerX === user.uid
  const isPlayerO = gameState.playerO === user.uid

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer finished, but don't auto-leave - let user click button
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const getResultMessage = () => {
    if (gameState.winner === "draw") {
      return "It's a Draw!"
    } else if (gameState.winner === "X") {
      return `${playerXName} Wins!`
    } else if (gameState.winner === "O") {
      return `${playerOName} Wins!`
    }
    return "Game Over"
  }

  const getPlayerResult = () => {
    if (gameState.winner === "draw") {
      return "Draw"
    } else if (
      (gameState.winner === "X" && isPlayerX) ||
      (gameState.winner === "O" && isPlayerO)
    ) {
      return "Victory"
    } else {
      return "Defeat"
    }
  }

  const handleBackToLobby = async () => {
    if (isCleaningUp) return // Prevent multiple calls
    
    setIsCleaningUp(true)
    try {
      // Extract game type from room ID (format: gameType-timestamp-random)
      const parts = roomId.split('-');
      const gameType = parts.slice(0, -2).join('-');
      
      // Call leave-result endpoint using generic game type
      const response = await fetch(`http://localhost:3001/game/${gameType}/${roomId}/leave-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      })
      
      if (!response.ok) {
        // If room is already deleted or not found, just go back to lobby
        console.log("Room already cleaned up or not found")
      }
    } catch (error) {
      console.error("Error leaving result screen:", error)
      // Even if there's an error, we should still go back to lobby
    } finally {
      setIsCleaningUp(false)
      // Add a small delay to ensure cleanup is complete before going back to lobby
      setTimeout(() => {
        onBackToLobby()
      }, 500)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 backdrop-blur">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {gameState.winner === "draw" ? (
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            ) : getPlayerResult() === "Victory" ? (
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-slate-100">
            {getResultMessage()}
          </CardTitle>
          <Badge
            variant={
              getPlayerResult() === "Victory"
                ? "default"
                : getPlayerResult() === "Draw"
                ? "secondary"
                : "destructive"
            }
            className="mt-2"
          >
            {getPlayerResult()}
          </Badge>
          
          {/* Countdown Timer */}
          <div className="mt-4 flex items-center justify-center space-x-2 text-slate-300">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {timeLeft > 0 
                ? `Auto-return to lobby in ${formatTime(timeLeft)}`
                : "Click 'Back to Lobby' to continue"
              }
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Players */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  X
                </div>
                <span className="text-slate-300">{playerXName}</span>
              </div>
              {gameState.winner === "X" && (
                <Badge variant="default" className="text-xs">
                  Winner
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  O
                </div>
                <span className="text-slate-300">{playerOName}</span>
              </div>
              {gameState.winner === "O" && (
                <Badge variant="default" className="text-xs">
                  Winner
                </Badge>
              )}
            </div>
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-slate-100">{gameState.moves}</div>
              <div className="text-sm text-slate-400">Total Moves</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-slate-100">
                {gameState.winner === "draw" ? "🤝" : "🎯"}
              </div>
              <div className="text-sm text-slate-400">Result</div>
            </div>
          </div>

          {/* Back to Lobby Button */}
          <Button
            onClick={handleBackToLobby}
            disabled={isCleaningUp}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3"
          >
            <Home className="w-4 h-4 mr-2" />
            {isCleaningUp ? "Leaving..." : timeLeft > 0 ? "Back to Lobby" : "Back to Lobby (Ready)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 