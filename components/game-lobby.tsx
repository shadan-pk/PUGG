"use client"

import { useState, useEffect } from "react"
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from "firebase/firestore"
import { db, isFirebaseConfigured } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import GameBoard from "@/components/game-board"
import { Users, Plus, Trophy, Clock, Gamepad2, Wifi, WifiOff, RefreshCw, AlertTriangle, LogOut } from "lucide-react"

interface User {
  uid: string
  email: string
  displayName: string
}

interface GameRoom {
  id: string
  name: string
  players: { [key: string]: { name: string; email: string } }
  status: "waiting" | "playing" | "finished"
  createdAt: any
  gameState: {
    board: (string | null)[]
    currentPlayer: "X" | "O"
    winner: string | null
    playerX: string
    playerO: string | null
    moves: number
  }
}

interface GameLobbyProps {
  user: User
  onLogout: () => void
}

export default function GameLobby({ user, onLogout }: GameLobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error" | "demo">("connecting")
  const [retryCount, setRetryCount] = useState(0)
  const { toast } = useToast()

  // Function to load rooms manually (fallback)
  const loadRoomsManually = async () => {
    try {
      console.log("🔄 Loading rooms manually...")
      const roomsRef = collection(db, "rooms")
      const snapshot = await getDocs(roomsRef)

      const roomList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GameRoom[]

      const activeRooms = roomList.filter((room) => room.status !== "finished")
      console.log("📋 Manually loaded rooms:", activeRooms.length)

      setRooms(activeRooms)
      setConnectionStatus("connected")

      toast({
        title: "🔄 Rooms Loaded",
        description: `Found ${activeRooms.length} active games`,
      })
    } catch (error) {
      console.error("❌ Manual room loading failed:", error)
      toast({
        title: "Load Failed",
        description: "Could not load rooms manually",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setConnectionStatus("demo")
      toast({
        title: "🎭 Demo Mode",
        description: "Add Firebase config to .env.local for real multiplayer!",
      })
      return
    }

    console.log("🔥 Setting up Firestore listeners... (attempt", retryCount + 1, ")")

    let unsubscribe: (() => void) | null = null

    const setupListener = async () => {
      try {
        // Test basic Firestore connection first
        console.log("🧪 Testing Firestore connection...")
        const testRef = collection(db, "rooms")

        // Try a simple query first
        const testSnapshot = await getDocs(testRef)
        console.log("✅ Firestore connection test successful, found", testSnapshot.docs.length, "documents")

        // Now set up the real-time listener
        console.log("👂 Setting up real-time listener...")
        const q = query(testRef, orderBy("createdAt", "desc"))

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log("📡 Firestore real-time update received:", snapshot.docs.length, "rooms")
            setConnectionStatus("connected")

            const roomList = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as GameRoom[]

            // Filter out finished games
            const activeRooms = roomList.filter((room) => room.status !== "finished")
            console.log("🎮 Active rooms:", activeRooms.length)
            setRooms(activeRooms)

            // Show success message only on first connection
            if (retryCount === 0) {
              toast({
                title: "🔥 Connected to Firestore!",
                description: "Real-time multiplayer is now active.",
              })
            }
          },
          (error) => {
            console.error("❌ Firestore real-time listener error:", error)
            setConnectionStatus("error")

            // Try manual loading as fallback
            console.log("🔄 Attempting manual room loading as fallback...")
            loadRoomsManually()

            toast({
              title: "Real-time Connection Issue",
              description: "Using manual refresh mode. Click 'Refresh Rooms' to update.",
              variant: "destructive",
            })
          },
        )
      } catch (error) {
        console.error("❌ Firestore setup error:", error)
        setConnectionStatus("error")

        // Try manual loading as fallback
        console.log("🔄 Setup failed, trying manual loading...")
        await loadRoomsManually()

        toast({
          title: "Connection Setup Failed",
          description: "Using manual mode. Click 'Refresh Rooms' to update.",
          variant: "destructive",
        })
      }
    }

    // Start the setup
    setupListener()

    // Cleanup function
    return () => {
      console.log("🔇 Cleaning up Firestore listener...")
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [toast, retryCount])

  const createRoom = async () => {
    if (!isFirebaseConfigured) {
      toast({
        title: "Demo Mode",
        description: "Add Firebase config to create real rooms!",
        variant: "destructive",
      })
      return
    }

    console.log("🎮 Creating room for user:", user.displayName)
    setLoading(true)

    try {
      const roomData = {
        name: `${user.displayName}'s Game`,
        players: {
          [user.uid]: {
            name: user.displayName,
            email: user.email,
          },
        },
        status: "waiting",
        createdAt: serverTimestamp(),
        gameState: {
          board: Array(9).fill(null),
          currentPlayer: "X",
          winner: null,
          playerX: user.uid,
          playerO: null,
          moves: 0,
        },
      }

      console.log("📤 Adding room to Firestore:", roomData)
      const docRef = await addDoc(collection(db, "rooms"), roomData)
      console.log("✅ Room created with ID:", docRef.id)

      setCurrentRoom(docRef.id)
      toast({
        title: "🎉 Room Created!",
        description: "Share the room ID with friends to join your game.",
      })
    } catch (error) {
      console.error("❌ Error creating room:", error)
      toast({
        title: "Error",
        description: `Failed to create room: ${error}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    if (!isFirebaseConfigured) {
      toast({
        title: "Demo Mode",
        description: "Add Firebase config to join real rooms!",
        variant: "destructive",
      })
      return
    }

    console.log("🚪 Joining room:", roomId)
    setLoading(true)

    try {
      const room = rooms.find((r) => r.id === roomId)
      if (!room) {
        toast({
          title: "Room Not Found",
          description: "This room no longer exists.",
          variant: "destructive",
        })
        return
      }

      const playerCount = Object.keys(room.players).length
      if (playerCount >= 2) {
        toast({
          title: "Room Full",
          description: "This room already has 2 players.",
          variant: "destructive",
        })
        return
      }

      if (Object.keys(room.players).includes(user.uid)) {
        setCurrentRoom(roomId)
        return
      }

      // Update room with new player
      const roomRef = doc(db, "rooms", roomId)
      await updateDoc(roomRef, {
        [`players.${user.uid}`]: {
          name: user.displayName,
          email: user.email,
        },
        "gameState.playerO": user.uid,
        status: "playing",
      })

      setCurrentRoom(roomId)
      toast({
        title: "🎮 Joined Game!",
        description: "Game is starting now!",
      })
    } catch (error) {
      console.error("❌ Error joining room:", error)
      toast({
        title: "Error",
        description: `Failed to join room: ${error}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const leaveRoom = async () => {
    if (!currentRoom || !isFirebaseConfigured) {
      setCurrentRoom(null)
      return
    }

    console.log("🚪 Leaving room:", currentRoom)
    try {
      const room = rooms.find((r) => r.id === currentRoom)
      if (!room) return

      const roomRef = doc(db, "rooms", currentRoom)

      // If only one player, delete the room
      if (Object.keys(room.players).length <= 1) {
        await deleteDoc(roomRef)
        console.log("🗑️ Room deleted (no players left)")
      } else {
        // Remove player and reset game
        const updatedPlayers = { ...room.players }
        delete updatedPlayers[user.uid]

        await updateDoc(roomRef, {
          players: updatedPlayers,
          "gameState.board": Array(9).fill(null),
          "gameState.currentPlayer": "X",
          "gameState.winner": null,
          "gameState.playerO": null,
          "gameState.moves": 0,
          status: "waiting",
        })
      }

      setCurrentRoom(null)
      toast({
        title: "👋 Left Game",
        description: "You have left the game room.",
      })
    } catch (error) {
      console.error("❌ Error leaving room:", error)
      toast({
        title: "Error",
        description: "Failed to leave room properly.",
        variant: "destructive",
      })
    }
  }

  const refreshConnection = () => {
    console.log("🔄 Refreshing connection...")
    setConnectionStatus("connecting")
    setRetryCount((prev) => prev + 1)
  }

  const refreshRooms = () => {
    console.log("🔄 Manual room refresh...")
    loadRoomsManually()
  }

  if (currentRoom) {
    return <GameBoard roomId={currentRoom} user={user} onLeave={leaveRoom} />
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Gamepad2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tic-Tac-Toe Online</h1>
              <p className="text-gray-600 dark:text-gray-400">Welcome, {user.displayName}!</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                connectionStatus === "connected"
                  ? "default"
                  : connectionStatus === "demo"
                    ? "secondary"
                    : connectionStatus === "connecting"
                      ? "secondary"
                      : "destructive"
              }
            >
              {connectionStatus === "connected" && <Wifi className="h-3 w-3 mr-1" />}
              {connectionStatus === "demo" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {connectionStatus === "error" && <WifiOff className="h-3 w-3 mr-1" />}
              {connectionStatus === "connecting" && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
              {connectionStatus === "connected"
                ? "🔥 Firestore Connected"
                : connectionStatus === "demo"
                  ? "Demo Mode"
                  : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Manual Mode"}
            </Badge>
            {connectionStatus === "error" && (
              <Button onClick={refreshConnection} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            {(connectionStatus === "error" || connectionStatus === "connected") && (
              <Button onClick={refreshRooms} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Rooms
              </Button>
            )}
            <Button onClick={onLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Status Alert */}
        {(connectionStatus === "error" || connectionStatus === "demo") && (
          <Alert
            className={
              connectionStatus === "error" ? "border-orange-200 bg-orange-50" : "border-yellow-200 bg-yellow-50"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {connectionStatus === "error" ? (
                <>
                  <strong>Manual Mode Active:</strong> Real-time updates are disabled. Room creation and joining still
                  work.
                  <br />
                  <small>Click "Refresh Rooms" to see new games, or "Retry" to restore real-time updates.</small>
                </>
              ) : (
                <>
                  <strong>Demo Mode Active:</strong> Add Firebase configuration to .env.local for real-time multiplayer.
                  <br />
                  <small>Fill in your Firebase config to enable cross-device gameplay!</small>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Active Rooms</p>
                  <p className="text-2xl font-bold">{rooms.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Online Players</p>
                  <p className="text-2xl font-bold">
                    {rooms.reduce((acc, room) => acc + Object.keys(room.players).length, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Games Playing</p>
                  <p className="text-2xl font-bold">{rooms.filter((room) => room.status === "playing").length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Room */}
        <Card>
          <CardHeader>
            <CardTitle>🎮 Create New Game</CardTitle>
            <CardDescription>
              Start a new game and share the room ID with friends to join
              {connectionStatus === "demo" && " (Add Firebase config for real multiplayer)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={createRoom} disabled={loading} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Creating..." : "Create Room"}
            </Button>
          </CardContent>
        </Card>

        {/* Available Rooms */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Available Games ({rooms.length})</CardTitle>
            <CardDescription>
              Join an existing game room
              {connectionStatus === "error" && " (Manual mode - click Refresh Rooms to update)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connectionStatus === "connecting" ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-500 dark:text-gray-400">Connecting to Firestore...</p>
              </div>
            ) : connectionStatus === "demo" ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Demo Mode Active</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Add Firebase configuration to see and join real rooms!
                </p>
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No active games found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Create a new room to start playing!</p>
                {connectionStatus === "error" && (
                  <Button onClick={refreshRooms} variant="outline" size="sm" className="mt-2 bg-transparent">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh Rooms
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium">{room.name}</h3>
                        <Badge variant={room.status === "waiting" ? "secondary" : "default"}>
                          {room.status === "waiting" ? "🟡 Waiting" : "🟢 Playing"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {Object.keys(room.players).length}/2 players • Room ID: {room.id.slice(-6)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {Object.values(room.players).map((player, index) => (
                        <div
                          key={index}
                          className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          title={player.name}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {Object.keys(room.players).length < 2 && (
                        <Button
                          size="sm"
                          onClick={() => joinRoom(room.id)}
                          disabled={loading || Object.keys(room.players).includes(user.uid)}
                        >
                          {Object.keys(room.players).includes(user.uid) ? "Rejoin" : "Join"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
