"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, RotateCcw, Copy, Share2 } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import ResultScreen from "./result-screen"

interface GameState {
  [key: string]: any
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
  roomId?: string
}

interface GameRenderer {
  renderBoard: (gameState: GameState, onMove: (moveData: any) => void, user: MockUser, loading: boolean) => React.ReactNode
  renderStatus: (gameState: GameState, players: { [key: string]: Player }, user: MockUser) => React.ReactNode
  renderPlayers: (gameState: GameState, players: { [key: string]: Player }, user: MockUser) => React.ReactNode
  isGameFinished: (gameState: GameState) => boolean
}

interface GenericGameBoardProps {
  gameType: string
  roomId: string
  user: MockUser
  onLeave: () => void
  gameRenderer: GameRenderer
}

export default function GenericGameBoard({
  gameType,
  roomId,
  user,
  onLeave,
  gameRenderer
}: GenericGameBoardProps) {
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const { toast } = useToast()
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Poll game state every second
  useEffect(() => {
    let stopped = false;
    async function pollGame() {
      while (!stopped) {
        try {
          const res = await fetch(`http://localhost:3001/game/${gameType}/${roomId}`);
          if (res.ok) {
            const data = await res.json();
            data.roomId = roomId; // Add roomId to the data
            setRoomData(data);
            setConnectionError(null);
          } else {
            setConnectionError("Room not found");
          }
        } catch (error) {
          setConnectionError("Failed to fetch game state");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    pollGame();
    return () => {
      stopped = true;
    };
  }, [roomId, gameType]);

  const makeMove = async (moveData: any) => {
    if (!roomData || gameRenderer.isGameFinished(roomData.gameState)) return
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:3001/game/${gameType}/${roomId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, ...moveData }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoomData(data);
      } else {
        const err = await res.json();
        toast({
          title: "Move Error",
          description: err.error || "Invalid move.",
          variant: "destructive",
        });
      }
    } catch (error) {
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
    toast({
      title: "Reset Not Supported",
      description: "Game reset is not implemented in this backend.",
      variant: "destructive",
    })
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
      title: "Join my game!",
      text: `Join my online game. Room ID: ${roomId.slice(-6)}`,
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

  const handleLeaveGame = async () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeave = async () => {
    setLeaving(true);
    try {
      await fetch(`http://localhost:3001/game/${gameType}/${roomId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
    } catch (error) {
      // Optionally show error
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
      onLeave();
    }
  };

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
          <p className="text-gray-600 dark:text-gray-400">Loading game from server...</p>
          <p className="text-sm text-gray-500 mt-2">Room ID: {roomId.slice(-6)}</p>
          <Button onClick={onLeave} variant="outline" size="sm" className="mt-4 bg-transparent">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const { gameState, players } = roomData
  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading game from server...</p>
          <p className="text-sm text-gray-500 mt-2">Room ID: {roomId.slice(-6)}</p>
          <Button onClick={onLeave} variant="outline" size="sm" className="mt-4 bg-transparent">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Show result screen when game ends
  if (gameRenderer.isGameFinished(gameState)) {
    return <ResultScreen roomData={roomData} user={user} onBackToLobby={onLeave} />
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={handleLeaveGame} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Leave Game
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎮 {gameRenderer.constructor.name}</h1>
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
              🔥 Live Game
            </Badge>
          </div>
          <Button onClick={resetGame} variant="outline" size="sm" disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Players Info */}
        {gameRenderer.renderPlayers(gameState, players, user)}

        {/* Game Board */}
        {gameRenderer.renderBoard(gameState, makeMove, user, loading)}

        {/* Game Status */}
        <div className="text-center mt-4">
          {gameRenderer.renderStatus(gameState, players, user)}
        </div>
      </div>
      {showLeaveConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2">Leave Game?</h2>
            <p className="mb-4">Leaving will forfeit the game and your opponent will win. Are you sure?</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowLeaveConfirm(false)} variant="outline" disabled={leaving}>Cancel</Button>
              <Button onClick={confirmLeave} variant="destructive" disabled={leaving}>Leave & Forfeit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 