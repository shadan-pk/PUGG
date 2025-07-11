# AI Game Development Guide: Adding a New Game

This guide is designed for AI code generation. It describes the minimal, step-by-step process to add a new game to the modular PUGG system. Follow this structure for every new game.

---

## 1. Backend: Create the Game Logic

**File:** `backend/games/[game-id].js`

```js
import { BaseGame } from './base-game.js';

export class [GameClassName] extends BaseGame {
  constructor() {
    super('[game-id]');
  }

  async tryMatchPlayers() {
    const queueLength = await this.getQueueLength();
    if (queueLength >= this.getMinPlayers()) {
      const players = [];
      while (players.length < this.getMinPlayers()) {
        const playerData = await this.popFromQueue();
        if (!playerData) break;
        players.push(JSON.parse(playerData));
      }
      if (players.length === this.getMinPlayers()) {
        return await this.createMatch(players);
      } else {
        for (const player of players) await this.addToQueue(player);
      }
    }
    return { matched: false };
  }

  createInitialGameState(players) {
    // Return initial state for your game
    return { /* ... */ };
  }

  validateMove(gameState, userId, moveData) {
    // Return { valid: true } or { valid: false, error: "reason" }
    return { valid: true };
  }

  makeMove(gameState, userId, moveData) {
    // Return new game state after move
    return { ...gameState };
  }

  checkGameEnd(gameState) {
    // Return { finished: true, winner, isDraw } or { finished: false }
    return { finished: false };
  }

  getGameDisplayName() { return "[Game Name]"; }
  getMinPlayers() { return 2; }
  getMaxPlayers() { return 2; }
}

const game = new [GameClassName]();
export const handleMatchmaking = (userId, username) => game.handleMatchmaking(userId, username);
export const cancelMatchmaking = (userId) => game.cancelMatchmaking(userId);
```

---

## 2. Backend: Register the Game

**File:** `backend/games/game-manager.js`

```js
import { [GameClassName] } from './[game-id].js';
// ...
class GameManager {
  initializeGames() {
    this.registerGame('tictactoe', new TicTacToeGame());
    this.registerGame('[game-id]', new [GameClassName]()); // Add this line
  }
}
```

---

## 3. Frontend: Create the Game Renderer

**File:** `components/game-renderers/[game-id]-renderer.tsx`

```tsx
"use client"
import { Card, CardContent } from "@/components/ui/card"

export class [GameClassName]Renderer {
  renderBoard(gameState, onMove, user, loading) {
    // Render the game board UI
    return <div>{/* ... */}</div>;
  }
  renderStatus(gameState, players, user) {
    // Render status (turn, winner, etc.)
    return <div>{/* ... */}</div>;
  }
  renderPlayers(gameState, players, user) {
    // Render player info
    return <div>{/* ... */}</div>;
  }
  isGameFinished(gameState) {
    // Return true if game is finished
    return false;
  }
}
```

---

## 4. Frontend: Register the Renderer

**File:** `components/game-lobby.tsx` (or wherever you map game types to renderers)

```tsx
import { [GameClassName]Renderer } from './game-renderers/[game-id]-renderer';

const gameRenderers = {
  tictactoe: new TicTacToeRenderer(),
  '[game-id]': new [GameClassName]Renderer(), // Add this line
};
```

When rendering a game:
```tsx
<GenericGameBoard
  gameType={selectedGame}
  roomId={roomId}
  user={user}
  onLeave={onLeave}
  gameRenderer={gameRenderers[selectedGame]}
/>
```

---

## 5. Test
- Start the backend and frontend.
- The new game should appear in the lobby automatically (fetched from `/games`).
- Matchmaking, game play, and result screen should work using the shared infrastructure.

---

## 6. API Endpoints (No changes needed)
- `/games` — List all games
- `/matchmaking/[game-id]` — Join matchmaking
- `/game/[game-id]/:roomId` — Get game state
- `/game/[game-id]/:roomId/move` — Make a move
- `/game/[game-id]/:roomId/leave` — Leave game
- `/game/[game-id]/:roomId/leave-result` — Leave result screen

---

## 7. Tips for AI
- Use the `[game-id]` as the unique identifier everywhere.
- Always extend `BaseGame` and implement all required methods.
- The frontend renderer must implement all four methods.
- The backend will automatically expose all endpoints for the new game.
- The frontend will automatically show the new game in the lobby.

---

**This template ensures every new game is fully integrated with matchmaking, session management, and the UI with minimal code.** 