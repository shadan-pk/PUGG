"use client"

import { useState, useEffect } from "react"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { db, isFirebaseConfigured } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, RotateCcw, Trophy, Users, Copy, Share2 } from "lucide-react"

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
  email: string
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
}

export default function GameBoard({
  roomId,
  user,
  onLeave,
}: {
  roomId: string
  user: MockUser
  onLeave: () => void
}) {
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!isFirebaseConfigured) {
      toast({
        title: "Demo Mode",
        description: "Set up Firestore for real-time gameplay.",
        variant: "destructive",
      })
      return
    }

    console.log("🎮 Setting up Firestore listener for room:", roomId)

    // Validate roomId
    if (!roomId || roomId.trim() === "") {
      console.error("❌ Invalid room ID:", roomId)
      setConnectionError("Invalid room ID")
      return
    }

    try {
      const roomRef = doc(db, "rooms", roomId)

      const unsubscribe = onSnapshot(
        roomRef,
        (docSnapshot) => {
          console.log("📡 Room snapshot received for:", roomId)

          if (docSnapshot.exists()) {
            const data = docSnapshot.data() as RoomData
            console.log("🎯 Room data updated:", data)
            setRoomData(data)
            setConnectionError(null)
          } else {
            console.log("❌ Room not found:", roomId)
            setConnectionError("Room not found")
            toast({
              title: "Room Not Found",
              description: "This room no longer exists.",
              variant: "destructive",
            })
            // Don't call onLeave immediately, let user decide
          }
        },
        (error) => {
          console.error("❌ Firestore listener error:", error)
          setConnectionError(error.message)
          toast({
            title: "Connection Error",
            description: `Failed to connect to room: ${error.message}`,
            variant: "destructive",
          })
        },
      )

      return () => {
        console.log("🔇 Cleaning up Firestore listener for room:", roomId)
        unsubscribe()
      }
    } catch (error) {
      console.error("❌ Error setting up Firestore listener:", error)
      setConnectionError(`Setup error: ${error}`)
      toast({
        title: "Setup Error",
        description: "Failed to set up room connection.",
        variant: "destructive",
      })
    }
  }, [roomId, onLeave, toast])

  const makeMove = async (index: number) => {
    if (!roomData || roomData.gameState.board[index] || roomData.gameState.winner || !isFirebaseConfigured) return

    const { gameState } = roomData
    const isPlayerX = gameState.playerX === user.uid
    const isPlayerO = gameState.playerO === user.uid
    const isCurrentPlayer =
      (gameState.currentPlayer === "X" && isPlayerX) || (gameState.currentPlayer === "O" && isPlayerO)

    if (!isCurrentPlayer) {
      toast({
        title: "Not Your Turn",
        description: "Please wait for your opponent to make a move.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const newBoard = [...gameState.board]
      newBoard[index] = gameState.currentPlayer

      const winner = checkWinner(newBoard)
      const isDraw = !winner && newBoard.every((cell) => cell !== null)

      const newGameState = {
        ...gameState,
        board: newBoard,
        currentPlayer: gameState.currentPlayer === "X" ? ("O" as const) : ("X" as const),
        winner: winner || (isDraw ? "draw" : null),
        moves: gameState.moves + 1,
      }

      console.log("🎯 Making move:", { index, player: gameState.currentPlayer, newGameState })

      const roomRef = doc(db, "rooms", roomId)
      await updateDoc(roomRef, { gameState: newGameState })

      if (winner) {
        const winnerName =
          winner === "X" ? roomData.players[gameState.playerX]?.name : roomData.players[gameState.playerO!]?.name
        toast({
          title: "🎉 Game Over!",
          description: `${winnerName} wins!`,
        })
      } else if (isDraw) {
        toast({
          title: "🤝 Game Over!",
          description: "It's a draw!",
        })
      }
    } catch (error) {
      console.error("❌ Error making move:", error)
      toast({
        title: "Error",
        description: "Failed to make move. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetGame = async () => {
    if (!roomData || !isFirebaseConfigured) return

    setLoading(true)
    try {
      const newGameState = {
        ...roomData.gameState,
        board: Array(9).fill(null),
        currentPlayer: "X" as const,
        winner: null,
        moves: 0,
      }

      console.log("🔄 Resetting game:", newGameState)
      const roomRef = doc(db, "rooms", roomId)
      await updateDoc(roomRef, { gameState: newGameState })

      toast({
        title: "🔄 Game Reset",
        description: "Starting a new game!",
      })
    } catch (error) {
      console.error("❌ Error resetting game:", error)
      toast({
        title: "Error",
        description: "Failed to reset game.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      toast({
        title: "📋 Room ID Copied!",
        description: "Share this ID with friends to join your game.",
      })
    } catch (error) {
      toast({
        title: "Room ID",
        description: `Room ID: ${roomId}`,
      })
    }
  }

  const shareGame = async () => {
    const shareData = {
      title: "Join my Tic-Tac-Toe game!",
      text: `Join my online Tic-Tac-Toe game. Room ID: ${roomId.slice(-6)}`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await copyRoomId()
      }
    } catch (error) {
      await copyRoomId()
    }
  }

  const checkWinner = (board: (string | null)[]): string | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // columns
      [0, 4, 8],
      [2, 4, 6], // diagonals
    ]

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    return null
  }

  // Handle demo mode
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 border rounded-lg">
            <h2 className="text-xl font-bold mb-2">Demo Mode</h2>
            <p className="text-gray-600 mb-4">Set up Firestore to play real games!</p>
            <Button onClick={onLeave}>Back to Lobby</Button>
          </div>
        </div>
      </div>
    )
  }

  // Handle connection errors
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 border rounded-lg max-w-md">
            <h2 className="text-xl font-bold mb-2 text-red-600">Connection Error</h2>
            <p className="text-gray-600 mb-4">{connectionError}</p>
            <div className="space-y-2">
              <Button onClick={onLeave} variant="outline" className="w-full bg-transparent">
                Back to Lobby
              </Button>
              <Button onClick={() => window.location.reload()} variant="default" className="w-full">
                Retry Connection
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle loading state
  if (!roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading game from Firestore...</p>
          <p className="text-sm text-gray-500 mt-2">Room ID: {roomId.slice(-6)}</p>
          <Button onClick={onLeave} variant="outline" size="sm" className="mt-4 bg-transparent">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const { gameState, players } = roomData
  const playerXName = players[gameState.playerX]?.name || "Player X"
  const playerOName = gameState.playerO ? players[gameState.playerO]?.name || "Player O" : "Waiting..."
  const isPlayerX = gameState.playerX === user.uid
  const isPlayerO = gameState.playerO === user.uid
  const currentPlayerName = gameState.currentPlayer === "X" ? playerXName : playerOName

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={onLeave} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Leave Game
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎮 Tic-Tac-Toe</h1>
            <div className="flex items-center justify-center space-x-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Room: {roomId.slice(-6)}</p>
              <Button onClick={copyRoomId} variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Copy className="h-3 w-3" />
              </Button>
              <Button onClick={shareGame} variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Share2 className="h-3 w-3" />
              </Button>
            </div>
            <Badge variant="default" className="text-xs mt-1">
              🔥 Firestore Live
            </Badge>
          </div>
          <Button onClick={resetGame} variant="outline" size="sm" disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Players Info */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={`${isPlayerX ? "ring-2 ring-blue-500" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  X
                </div>
                <div>
                  <p className="font-medium">{playerXName}</p>
                  <p className="text-sm text-gray-500">Player X</p>
                </div>
                {isPlayerX && <Badge variant="secondary">You</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card className={`${isPlayerO ? "ring-2 ring-red-500" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                  O
                </div>
                <div>
                  <p className="font-medium">{playerOName}</p>
                  <p className="text-sm text-gray-500">Player O</p>
                </div>
                {isPlayerO && <Badge variant="secondary">You</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Game Status */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              {gameState.winner ? (
                <div className="space-y-2">
                  <Trophy className="h-8 w-8 text-yellow-500 mx-auto" />
                  <p className="text-xl font-bold">
                    {gameState.winner === "draw"
                      ? "🤝 It's a Draw!"
                      : `🎉 ${gameState.winner === "X" ? playerXName : playerOName} Wins!`}
                  </p>
                </div>
              ) : !gameState.playerO ? (
                <div className="space-y-2">
                  <Users className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="text-lg">⏳ Waiting for another player...</p>
                  <p className="text-sm text-gray-500">Share the room ID with a friend!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg">
                    <span className="font-bold">{currentPlayerName}</span>'s turn
                  </p>
                  <Badge variant={gameState.currentPlayer === "X" ? "default" : "destructive"}>
                    {gameState.currentPlayer}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Game Board */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {gameState.board.map((cell, index) => (
                <button
                  key={index}
                  onClick={() => makeMove(index)}
                  disabled={loading || !!cell || !!gameState.winner || !gameState.playerO}
                  className="aspect-square bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-4xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {cell && <span className={cell === "X" ? "text-blue-600" : "text-red-600"}>{cell}</span>}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Game Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">📊 Game Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{gameState.moves}</p>
                <p className="text-sm text-gray-500">Total Moves</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.keys(players).length}/2</p>
                <p className="text-sm text-gray-500">Players</p>
              </div>
              <div>
                <p className="text-2xl font-bold">🔥</p>
                <p className="text-sm text-gray-500">Firestore Live</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
