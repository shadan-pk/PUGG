"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

export class TicTacToeRenderer {
  renderBoard(gameState: GameState, onMove: (moveData: any) => void, user: MockUser, loading: boolean) {
    const isPlayerX = gameState.playerX === user.uid
    const isPlayerO = gameState.playerO === user.uid

    return (
      <div className="grid grid-cols-3 gap-2 bg-slate-800 rounded-lg p-4">
        {gameState.board.map((cell, idx) => (
          <button
            key={idx}
            className={`w-20 h-20 text-3xl font-bold rounded-lg border-2 flex items-center justify-center transition-all duration-150
              ${cell === "X" ? "text-blue-500 border-blue-400" : cell === "O" ? "text-purple-500 border-purple-400" : "border-slate-700 hover:border-blue-400 hover:bg-slate-700"}
              ${gameState.winner && cell === gameState.winner ? "bg-green-100" : ""}
            `}
            disabled={!!cell || !!gameState.winner || loading || !isPlayerX && !isPlayerO}
            onClick={() => onMove({ index: idx })}
          >
            {cell}
          </button>
        ))}
      </div>
    )
  }

  renderStatus(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const playerXName = players[gameState.playerX]?.name || "Player X"
    const playerOName = players[gameState.playerO!]?.name || "Player O"
    const isPlayerX = gameState.playerX === user.uid
    const isPlayerO = gameState.playerO === user.uid

    if (gameState.winner) {
      if (gameState.winner === "draw") {
        return <div className="text-lg font-bold text-yellow-500">🤝 It's a draw!</div>
      } else {
        return <div className="text-lg font-bold text-green-600">🎉 {gameState.winner === "X" ? playerXName : playerOName} wins!</div>
      }
    } else {
      return (
        <div className="text-md text-slate-300">
          {isPlayerX || isPlayerO ? (
            gameState.currentPlayer === (isPlayerX ? "X" : "O") ? (
              <span>Your turn ({gameState.currentPlayer})</span>
            ) : (
              <span>Waiting for opponent...</span>
            )
          ) : (
            <span>Spectating</span>
          )}
        </div>
      )
    }
  }

  renderPlayers(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const playerXName = players[gameState.playerX]?.name || "Player X"
    const playerOName = players[gameState.playerO!]?.name || "Player O"
    const isPlayerX = gameState.playerX === user.uid
    const isPlayerO = gameState.playerO === user.uid

    return (
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
            </div>
          </CardContent>
        </Card>
        <Card className={`${isPlayerO ? "ring-2 ring-purple-500" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                O
              </div>
              <div>
                <p className="font-medium">{playerOName}</p>
                <p className="text-sm text-gray-500">Player O</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  isGameFinished(gameState: GameState): boolean {
    return !!gameState.winner
  }
} 