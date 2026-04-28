import express, { Express } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io'; // Server class for creating Socket.io server, Socket type for typing socket connections
import cors from 'cors'; // CORS middleware to allow cross-origin requests
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const httpServer = createServer(app); // wrap Express app in an HTTP server for Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface UserSession {
  userId: string;
  socketId: string;
  username: string;
  phoneNumber: string;
}

interface CallStats {
  latency: number;
  packetLoss: number;
  bandwidth: number;
  jitter: number;
}

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

const users: Map<string, UserSession> = new Map();
const rooms: Map<string, string[]> = new Map(); // roomId -> [userId1, userId2]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getUserBySocketId(socketId: string): UserSession | undefined {
  return Array.from(users.values()).find(u => u.socketId === socketId);
}

function getUserById(userId: string): UserSession | undefined {
  return Array.from(users.values()).find(u => u.userId === userId);
}

function broadcastUserList(): void {
  io.emit('users-updated', Array.from(users.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    phoneNumber: u.phoneNumber
  })));
}

function cleanupRoomForUser(userId: string): void {
  for (const [roomId, participants] of rooms.entries()) {
    if (participants.includes(userId)) {
      // Notify the other participant
      const otherUserId = participants.find(id => id !== userId);
      if (otherUserId) {
        const otherSession = getUserById(otherUserId);
        if (otherSession) {
          io.to(otherSession.socketId).emit('call-ended', { callId: roomId });
          console.log(`📵 [Cleanup] Notified ${otherSession.username} that call ended`);
        }
      }
      rooms.delete(roomId);
      console.log(`🧹 [Cleanup] Room ${roomId} removed`);
      break;
    }
  }
}

// ─────────────────────────────────────────────
// REST API
// ─────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'VoIP Platform is running',
    activeUsers: users.size,
    activeRooms: rooms.size
  });
});

app.get('/api/users', (_req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    phoneNumber: u.phoneNumber
  }));
  res.json(userList);
});

app.get('/api/rooms', (_req, res) => {
  const roomList = Array.from(rooms.entries()).map(([roomId, participants]) => ({
    roomId,
    participants
  }));
  res.json(roomList);
});

// ─────────────────────────────────────────────
// Socket.io
// ─────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // ── Register ──────────────────────────────

  socket.on('register', (data: { userId: string; username: string; phoneNumber?: string }) => {
    const { userId, username, phoneNumber } = data;

    // FIX #5 — clean up old session before registering new one
    if (users.has(userId)) {
      console.log(`[Register] Replacing old session for ${username}`);
      users.delete(userId);
    }

    users.set(userId, {
      userId,
      socketId: socket.id,
      username,
      phoneNumber: phoneNumber || 'Unknown'
    });

    console.log(`[Register] User ${username} (${phoneNumber || 'Unknown'}) registered with socket ${socket.id}`);

    broadcastUserList();
  });

  // ── Initiate Call ─────────────────────────

  socket.on('call-user', (data: {
    callerId: string;
    receiverId: string;
    offer: unknown;
  }) => {
    const { callerId, receiverId, offer } = data;

    const receiverSession = getUserById(receiverId);
    const callerSession = getUserById(callerId);

    if (!receiverSession) {
      socket.emit('call-failed', { message: 'User not found or offline' });
      return;
    }

    // FIX #1 — include callerName so client can display it
    const callerName = callerSession?.username || callerId;

    io.to(receiverSession.socketId).emit('incoming-call', {
      callerId,
      callerName, // ✅ now included
      offer
    });

    console.log(`☎️ [Call] ${callerName} → ${receiverSession.username}`);
  });

  // ── Answer Call ───────────────────────────

  socket.on('call-answer', (data: {
    callerId: string;
    receiverId: string;
    answer: unknown;
  }) => {
    const { callerId, receiverId, answer } = data;

    const callerSession = getUserById(callerId);
    const receiverSession = getUserById(receiverId);

    if (!callerSession) {
      console.warn(`[Answer] Caller ${callerId} not found`);
      return;
    }

    io.to(callerSession.socketId).emit('call-answered', {
      receiverId,
      answer
    });

    // Create room using consistent key
    const roomId = `${callerId}-${receiverId}`;
    rooms.set(roomId, [callerId, receiverId]);

    const receiverName = receiverSession?.username || receiverId;
    console.log(`✅ [Connected] ${callerSession.username} ↔ ${receiverName} | Room: ${roomId}`);
  });

  // ── ICE Candidates ────────────────────────

  socket.on('ice-candidate', (data: {
    to: string;
    candidate: unknown;
  }) => {
    const { to, candidate } = data;
    const targetSession = getUserById(to);

    if (targetSession) {
      io.to(targetSession.socketId).emit('ice-candidate', { candidate });
    }
  });

  // ── Call Stats ────────────────────────────

  socket.on('call-stats', (data: {
    callId: string;
    stats: CallStats;
  }) => {
    const { callId, stats } = data;

    // FIX #2 — only send stats to participants in this room, not all users
    const participants = rooms.get(callId);

    if (participants) {
      participants.forEach(userId => {
        const session = getUserById(userId);
        if (session) {
          io.to(session.socketId).emit('stats-updated', {
            callId,
            stats,
            timestamp: new Date()
          });
        }
      });
    }

    console.log(
      `[Stats] Call ${callId}: latency=${stats.latency}ms, ` +
      `loss=${stats.packetLoss}%, jitter=${stats.jitter}ms, bw=${stats.bandwidth}Kbps`
    );
  });

  // ── End Call ──────────────────────────────

  socket.on('end-call', (data: { callId: string; participants: string[] }) => {
    const { callId } = data;

    // FIX #6 — use server's room data as source of truth, not client-provided participants
    const roomParticipants = rooms.get(callId) || data.participants;

    roomParticipants.forEach(userId => {
      const userSession = getUserById(userId);
      if (userSession && userSession.socketId !== socket.id) {
        io.to(userSession.socketId).emit('call-ended', { callId });
      }
    });

    // FIX #3 — always clean up room on end
    rooms.delete(callId);

    console.log(`📵 [Disconnected] Call ${callId} ended`);
  });

  // ── Reject Call ───────────────────────────

  socket.on('reject-call', (data: { callerId: string }) => {
    const { callerId } = data;
    const callerSession = getUserById(callerId);

    if (callerSession) {
      io.to(callerSession.socketId).emit('call-rejected', {
        message: 'Call rejected by receiver'
      });
      console.log(`❌ [Rejected] Call from ${callerSession.username}`);
    }
  });

  // ── Disconnect ────────────────────────────

  socket.on('disconnect', () => {
    const disconnectedUser = getUserBySocketId(socket.id);

    if (disconnectedUser) {
      users.delete(disconnectedUser.userId);
      console.log(`[Disconnect] User ${disconnectedUser.username} (${disconnectedUser.phoneNumber}) disconnected`);

      // FIX #4 — clean up any active room and notify the other participant
      cleanupRoomForUser(disconnectedUser.userId);

      broadcastUserList();
    } else {
      console.log(`[Disconnect] Unknown socket ${socket.id} disconnected`);
    }
  });

  // ── Error ─────────────────────────────────

  socket.on('error', (error) => {
    console.error(`[Socket Error] ${socket.id}:`, error);
  });
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`☎️  VoIP System ready for connections`);
});