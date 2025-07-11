"use client"

import { Card, CardContent } from "@/components/ui/card"

interface GameState {
  board: (number | null)[][]
  currentPlayer: number
  finished: boolean
  winner: { userId: string; username: string } | null
  isDraw: boolean
  players: { userId: string; username: string }[]
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

export class ConnectFourRenderer {
  renderBoard(gameState: GameState, onMove: (moveData: any) => void, user: MockUser, loading: boolean) {
    const { board } = gameState;
    const isPlayer = gameState.players.some(p => p.userId === user.uid);
    
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="grid grid-cols-7 gap-1 p-4 bg-blue-600 rounded-lg">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => !loading && onMove({ column: colIndex })}
                disabled={loading || this.isGameFinished(gameState) || !isPlayer}
                className="w-12 h-12 rounded-full border-2 border-blue-800 flex items-center justify-center hover:bg-blue-500 transition-colors"
              >
                {cell !== null && (
                  <div
                    className={`w-10 h-10 rounded-full ${
                      cell === 0 ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                )}
              </button>
            ))
          )}
        </div>
        
        {/* Column indicators */}
        <div className="grid grid-cols-7 gap-1">
          {Array(7).fill(null).map((_, colIndex) => (
            <button
              key={colIndex}
              onClick={() => !loading && onMove({ column: colIndex })}
              disabled={loading || this.isGameFinished(gameState) || board[0][colIndex] !== null || !isPlayer}
              className="w-12 h-6 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold transition-colors disabled:opacity-50 text-white"
            >
              ↓
            </button>
          ))}
        </div>
      </div>
    );
  }

  renderStatus(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const player1Name = players[gameState.players[0]?.userId]?.name || gameState.players[0]?.username || "Player 1";
    const player2Name = players[gameState.players[1]?.userId]?.name || gameState.players[1]?.username || "Player 2";
    const isPlayer1 = gameState.players[0]?.userId === user.uid;
    const isPlayer2 = gameState.players[1]?.userId === user.uid;
    
    if (gameState.finished) {
      if (gameState.isDraw) {
        return <div className="text-lg font-bold text-yellow-500">🤝 It's a draw!</div>;
      } else {
        const winnerName = players[gameState.winner!.userId]?.name || gameState.winner!.username;
        const isWinner = gameState.winner!.userId === user.uid;
        return (
          <div className={`text-lg font-bold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
            🎉 {winnerName} wins!
          </div>
        );
      }
    }

    const currentPlayerName = gameState.currentPlayer === 0 ? player1Name : player2Name;
    const isYourTurn = (gameState.currentPlayer === 0 && isPlayer1) || (gameState.currentPlayer === 1 && isPlayer2);
    
    return (
      <div className="text-md text-slate-300">
        {isPlayer1 || isPlayer2 ? (
          isYourTurn ? (
            <span>Your turn - Drop your piece!</span>
          ) : (
            <span>Waiting for {currentPlayerName}...</span>
          )
        ) : (
          <span>Spectating</span>
        )}
      </div>
    );
  }

  renderPlayers(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const player1Name = players[gameState.players[0]?.userId]?.name || gameState.players[0]?.username || "Player 1";
    const player2Name = players[gameState.players[1]?.userId]?.name || gameState.players[1]?.username || "Player 2";
    const isPlayer1 = gameState.players[0]?.userId === user.uid;
    const isPlayer2 = gameState.players[1]?.userId === user.uid;

    return (
      <div className="grid grid-cols-2 gap-4">
        <Card className={`${isPlayer1 ? "ring-2 ring-red-500" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <p className="font-medium">{player1Name}</p>
                <p className="text-sm text-gray-500">Red Player</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`${isPlayer2 ? "ring-2 ring-yellow-500" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <p className="font-medium">{player2Name}</p>
                <p className="text-sm text-gray-500">Yellow Player</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  isGameFinished(gameState: GameState): boolean {
    return gameState.finished;
  }
}