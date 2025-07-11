# Game Development Guide

This guide explains how to add new games to the PUGG (Player Unified Game Gateway) system.

## Architecture Overview

The system is designed with a modular architecture that separates common functionality from game-specific logic:

### Backend Structure
```
backend/
├── games/
│   ├── base-game.js          # Base class with common functionality
│   ├── game-manager.js       # Manages all games
│   ├── tictactoe.js          # Tic Tac Toe implementation
│   └── [new-game].js         # Your new game
├── index.js                  # Main server with generic endpoints
└── utils/
    └── firestore.js          # Database utilities
```

### Frontend Structure
```
components/
├── game-board-generic.tsx    # Generic game board component
├── game-renderers/
│   ├── tictactoe-renderer.tsx # Tic Tac Toe UI renderer
│   └── [new-game]-renderer.tsx # Your new game UI renderer
└── result-screen.tsx         # Shared result screen
```

## Adding a New Game

### Step 1: Create the Backend Game Class

Create a new file `backend/games/[game-name].js`:

```javascript
import { BaseGame } from './base-game.js';

export class YourGame extends BaseGame {
  constructor() {
    super('yourgame'); // This will create 'yourgame:queue' and 'yourgame:session:' prefixes
  }

  // Required abstract methods:

  async tryMatchPlayers() {
    const queueLength = await this.getQueueLength();
    
    // Implement your matching logic
    if (queueLength >= this.getMinPlayers()) {
      // Match players and create session
      return await this.createMatch(players);
    }
    
    return { matched: false };
  }

  createInitialGameState(players) {
    // Return the initial state for your game
    return {
      // Your game state structure
    };
  }

  validateMove(gameState, userId, moveData) {
    // Validate if the move is legal
    return { valid: true }; // or { valid: false, error: "reason" }
  }

  makeMove(gameState, userId, moveData) {
    // Apply the move and return new game state
    return {
      ...gameState,
      // Updated state
    };
  }

  checkGameEnd(gameState) {
    // Check if game is finished
    if (/* game is over */) {
      return {
        finished: true,
        winner: "playerId",
        isDraw: false
      };
    }
    return { finished: false };
  }

  getGameDisplayName() {
    return "Your Game Name";
  }

  getMinPlayers() {
    return 2; // or however many players your game needs
  }

  getMaxPlayers() {
    return 4; // maximum players
  }
}

// Export singleton instance
const yourGame = new YourGame();
export const handleMatchmaking = (userId, username) => yourGame.handleMatchmaking(userId, username);
export const cancelMatchmaking = (userId) => yourGame.cancelMatchmaking(userId);
```

### Step 2: Register Your Game

Add your game to `backend/games/game-manager.js`:

```javascript
import { YourGame } from './yourgame.js';

class GameManager {
  initializeGames() {
    // Register all games
    this.registerGame('tictactoe', new TicTacToeGame());
    this.registerGame('yourgame', new YourGame()); // Add this line
  }
}
```

### Step 3: Create the Frontend Renderer

Create `components/game-renderers/[game-name]-renderer.tsx`:

```typescript
"use client"

import { Card, CardContent } from "@/components/ui/card"

interface GameState {
  // Define your game state interface
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

export class YourGameRenderer {
  renderBoard(gameState: GameState, onMove: (moveData: any) => void, user: MockUser, loading: boolean) {
    // Render your game board
    return (
      <div>
        {/* Your game board UI */}
      </div>
    )
  }

  renderStatus(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    // Render game status (whose turn, game over, etc.)
    return (
      <div>
        {/* Status information */}
      </div>
    )
  }

  renderPlayers(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    // Render player information
    return (
      <div>
        {/* Player cards/info */}
      </div>
    )
  }

  isGameFinished(gameState: GameState): boolean {
    // Check if game is finished
    return !!gameState.winner || gameState.status === 'finished';
  }
}
```

### Step 4: Update the Game Lobby

Add your game to the lobby in `components/game-lobby.tsx`:

```typescript
import { YourGameRenderer } from './game-renderers/yourgame-renderer'
import GenericGameBoard from './game-board-generic'

// In your component:
const gameRenderers = {
  tictactoe: new TicTacToeRenderer(),
  yourgame: new YourGameRenderer(), // Add this
}

// When rendering the game board:
if (gameType === 'yourgame') {
  return (
    <GenericGameBoard
      gameType="yourgame"
      roomId={roomId}
      user={user}
      onLeave={onLeave}
      gameRenderer={gameRenderers.yourgame}
    />
  )
}
```

## API Endpoints

The backend automatically provides these endpoints for your game:

- `POST /matchmaking/[gameType]` - Start matchmaking
- `POST /matchmaking/[gameType]/cancel` - Cancel matchmaking
- `GET /matchmaking/[gameType]/status` - Check matchmaking status
- `GET /game/[gameType]/[roomId]` - Get game state
- `POST /game/[gameType]/[roomId]/move` - Make a move
- `POST /game/[gameType]/[roomId]/leave` - Leave game
- `POST /game/[gameType]/[roomId]/leave-result` - Leave result screen

## Example: Adding Rock Paper Scissors

Here's a complete example of adding Rock Paper Scissors:

### Backend (`backend/games/rps.js`):

```javascript
import { BaseGame } from './base-game.js';

export class RockPaperScissorsGame extends BaseGame {
  constructor() {
    super('rps');
  }

  async tryMatchPlayers() {
    const queueLength = await this.getQueueLength();
    
    if (queueLength >= 2) {
      const players = [];
      while (players.length < 2) {
        const playerData = await this.popFromQueue();
        if (!playerData) break;
        players.push(JSON.parse(playerData));
      }

      if (players.length === 2) {
        return await this.createMatch(players);
      } else {
        for (const player of players) {
          await this.addToQueue(player);
        }
      }
    }
    
    return { matched: false };
  }

  createInitialGameState(players) {
    return {
      player1: players[0].userId,
      player2: players[1].userId,
      choices: {},
      round: 1,
      scores: { [players[0].userId]: 0, [players[1].userId]: 0 },
      winner: null
    };
  }

  validateMove(gameState, userId, moveData) {
    const { choice } = moveData;
    
    if (!['rock', 'paper', 'scissors'].includes(choice)) {
      return { valid: false, error: "Invalid choice" };
    }
    
    if (gameState.choices[userId]) {
      return { valid: false, error: "Already made choice" };
    }
    
    return { valid: true };
  }

  makeMove(gameState, userId, moveData) {
    const { choice } = moveData;
    
    const newGameState = {
      ...gameState,
      choices: { ...gameState.choices, [userId]: choice }
    };
    
    // Check if both players made choices
    if (Object.keys(newGameState.choices).length === 2) {
      const result = this.determineWinner(newGameState.choices);
      if (result.winner) {
        newGameState.scores[result.winner]++;
        newGameState.winner = result.winner;
      }
      newGameState.choices = {};
      newGameState.round++;
    }
    
    return newGameState;
  }

  determineWinner(choices) {
    const [player1, player2] = Object.keys(choices);
    const choice1 = choices[player1];
    const choice2 = choices[player2];
    
    if (choice1 === choice2) return { winner: null, isDraw: true };
    
    const rules = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper'
    };
    
    if (rules[choice1] === choice2) {
      return { winner: player1 };
    } else {
      return { winner: player2 };
    }
  }

  checkGameEnd(gameState) {
    if (gameState.scores[gameState.player1] >= 3 || gameState.scores[gameState.player2] >= 3) {
      const winner = gameState.scores[gameState.player1] >= 3 ? gameState.player1 : gameState.player2;
      return {
        finished: true,
        winner: winner,
        isDraw: false
      };
    }
    return { finished: false };
  }

  getGameDisplayName() {
    return "Rock Paper Scissors";
  }

  getMinPlayers() {
    return 2;
  }

  getMaxPlayers() {
    return 2;
  }
}

const rpsGame = new RockPaperScissorsGame();
export const handleMatchmaking = (userId, username) => rpsGame.handleMatchmaking(userId, username);
export const cancelMatchmaking = (userId) => rpsGame.cancelMatchmaking(userId);
```

### Frontend Renderer (`components/game-renderers/rps-renderer.tsx`):

```typescript
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface GameState {
  player1: string
  player2: string
  choices: { [key: string]: string }
  round: number
  scores: { [key: string]: number }
  winner: string | null
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

export class RPSRenderer {
  renderBoard(gameState: GameState, onMove: (moveData: any) => void, user: MockUser, loading: boolean) {
    const hasChosen = !!gameState.choices[user.uid];
    const bothChosen = Object.keys(gameState.choices).length === 2;
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-bold">Round {gameState.round}</h3>
          <p className="text-sm text-gray-600">
            {hasChosen ? "Waiting for opponent..." : "Choose your weapon!"}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {['rock', 'paper', 'scissors'].map((choice) => (
            <Button
              key={choice}
              onClick={() => onMove({ choice })}
              disabled={hasChosen || loading}
              className="h-20 text-lg font-bold"
            >
              {choice.toUpperCase()}
            </Button>
          ))}
        </div>
        
        {bothChosen && (
          <div className="text-center p-4 bg-gray-100 rounded">
            <p>Both players chose! Round complete.</p>
          </div>
        )}
      </div>
    )
  }

  renderStatus(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const player1Name = players[gameState.player1]?.name || "Player 1";
    const player2Name = players[gameState.player2]?.name || "Player 2";
    
    return (
      <div className="text-center">
        <div className="text-lg font-bold">
          {player1Name}: {gameState.scores[gameState.player1]} - {player2Name}: {gameState.scores[gameState.player2]}
        </div>
      </div>
    )
  }

  renderPlayers(gameState: GameState, players: { [key: string]: Player }, user: MockUser) {
    const player1Name = players[gameState.player1]?.name || "Player 1";
    const player2Name = players[gameState.player2]?.name || "Player 2";
    
    return (
      <div className="grid grid-cols-2 gap-4">
        <Card className={gameState.player1 === user.uid ? "ring-2 ring-blue-500" : ""}>
          <CardContent className="p-4">
            <p className="font-medium">{player1Name}</p>
            <p className="text-sm text-gray-500">Score: {gameState.scores[gameState.player1]}</p>
          </CardContent>
        </Card>
        <Card className={gameState.player2 === user.uid ? "ring-2 ring-blue-500" : ""}>
          <CardContent className="p-4">
            <p className="font-medium">{player2Name}</p>
            <p className="text-sm text-gray-500">Score: {gameState.scores[gameState.player2]}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  isGameFinished(gameState: GameState): boolean {
    return gameState.scores[gameState.player1] >= 3 || gameState.scores[gameState.player2] >= 3;
  }
}
```

## Best Practices

1. **Follow the Interface**: Always implement all required abstract methods
2. **Use TypeScript**: Define proper interfaces for your game state
3. **Handle Edge Cases**: Consider network errors, disconnections, etc.
4. **Test Thoroughly**: Test with multiple players and various scenarios
5. **Keep It Simple**: Start with basic functionality, add features later
6. **Document Your Game**: Add comments explaining game-specific logic

## Common Patterns

### Turn-Based Games
- Use `currentPlayer` field in game state
- Validate moves based on whose turn it is
- Update `currentPlayer` after each move

### Real-Time Games
- Consider using WebSockets for real-time updates
- Implement heartbeat/ping mechanisms
- Handle player disconnections gracefully

### Multi-Player Games
- Implement proper player ordering
- Handle variable player counts
- Consider team-based games

This architecture makes it easy to add new games while reusing all the common functionality like matchmaking, session management, and result screens! 