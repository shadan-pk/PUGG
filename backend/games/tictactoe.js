// backend/games/tictactoe.js
import { createClient } from 'redis';

const redis = createClient({ url: 'redis://localhost:6379' }); // adjust if your Docker uses a different host/port
redis.connect().catch(console.error);
  
export async function handleMatchmaking(userId, username) {
  const queueKey = 'tictactoe:queue';
  const sessionPrefix = 'tictactoe:session:';

  // Check if user is already in a session
  const existingSessionId = await redis.get(`user:${userId}:session`);
  if (existingSessionId) {
    console.log(`User ${userId} already in session ${existingSessionId}`);
    return { matched: true, roomId: existingSessionId };
  }

  // Add user to the matchmaking queue
  await redis.rPush(queueKey, JSON.stringify({ userId, username }));
  console.log(`Added ${username} (${userId}) to queue`);

  // Check queue length
  const queueLength = await redis.lLen(queueKey);
  console.log(`Queue length after adding ${username}: ${queueLength}`);

  // Only try to match if we have at least 2 players
  if (queueLength >= 2) {
    // Try to match two players
    const players = [];
    while (players.length < 2) {
      const playerData = await redis.lPop(queueKey);
      if (!playerData) break;
      players.push(JSON.parse(playerData));
    }

    console.log(`Popped ${players.length} players from queue`);

    if (players.length === 2) {
      // Create a new session
      const roomId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const sessionKey = sessionPrefix + roomId;

      console.log(`Creating match: ${players[0].username} vs ${players[1].username} in room ${roomId}`);

      // Store session data in Redis
      const sessionData = {
        roomId,
        players: {
          [players[0].userId]: { name: players[0].username },
          [players[1].userId]: { name: players[1].username }
        },
        createdAt: Date.now(),
        status: 'active',
        gameState: {
          board: Array(9).fill(null),
          currentPlayer: 'X',
          winner: null,
          playerX: players[0].userId,
          playerO: players[1].userId,
          moves: 0
        }
      };
      await redis.set(sessionKey, JSON.stringify(sessionData));

      // Map users to session for quick lookup
      await redis.set(`user:${players[0].userId}:session`, roomId);
      await redis.set(`user:${players[1].userId}:session`, roomId);

      console.log(`Match created successfully for room ${roomId}`);
      return { matched: true, roomId };
    } else {
      // Put players back in queue if we couldn't match
      for (const player of players) {
        await redis.rPush(queueKey, JSON.stringify(player));
      }
      console.log(`Put ${players.length} players back in queue`);
    }
  }

  // Not enough players yet
  console.log(`Not enough players for ${username}, waiting...`);
  return { matched: false };
}

export async function cancelMatchmaking(userId) {
  const queueKey = 'tictactoe:queue';
  // Remove user from queue (inefficient for large queues, but fine for small games)
  const queue = await redis.lRange(queueKey, 0, -1);
  for (let i = 0; i < queue.length; i++) {
    const player = JSON.parse(queue[i]);
    if (player.userId === userId) {
      await redis.lRem(queueKey, 1, queue[i]);
      console.log(`Removed ${player.username} from queue`);
      break;
    }
  }
  // Optionally, remove session mapping if exists
  await redis.del(`user:${userId}:session`);
}