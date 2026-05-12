const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Models
const User = require('./models/User');
const Session = require('./models/Session');

// Routes
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const aiRoutes = require('./routes/aiRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const quizRoutes = require('./routes/quizRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/quizzes', quizRoutes);

// --- New Standardized WebRTC Signaling System ---
const users = {}; // { socketId: { roomId, userName } }

io.on('connection', (socket) => {
  console.log('🟢 New Peer Connection:', socket.id);

  socket.on('join-room', ({ roomId, name }) => {
    const normalizedRoomId = roomId?.trim().toLowerCase();
    if (!normalizedRoomId) return;

    socket.join(normalizedRoomId);
    users[socket.id] = { roomId: normalizedRoomId, name };
    
    // 1. Get other users in this room
    const otherUsers = [];
    const clients = io.sockets.adapter.rooms.get(normalizedRoomId);
    if (clients) {
      clients.forEach(clientId => {
        if (clientId !== socket.id) {
          otherUsers.push({ userId: clientId, name: users[clientId]?.name || 'Anonymous' });
        }
      });
    }

    // 2. Tell the newcomer who is already there
    socket.emit('all-users', otherUsers);
    
    console.log(`[Room ${normalizedRoomId}] ${name} joined. Total peers: ${otherUsers.length + 1}`);
  });

  // Relay Offer (Initiated by newcomer to everyone already in the room)
  socket.on('sending-signal', ({ userToSignal, signal, callerId }) => {
    io.to(userToSignal).emit('user-joined', { signal, callerId, name: users[socket.id]?.name });
  });

  // Relay Answer (Sent back by existing users to the newcomer)
  socket.on('returning-signal', ({ callerId, signal }) => {
    io.to(callerId).emit('receiving-returned-signal', { signal, id: socket.id });
  });

  // Relay ICE Candidates
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Screen Share Relay
  socket.on('screen-share-status', ({ roomId, isSharing }) => {
    const normalizedRoomId = roomId?.trim().toLowerCase();
    socket.to(normalizedRoomId).emit('screen-share-status', { userId: socket.id, isSharing });
  });

  // Chat Relay
  socket.on('chat-message', async ({ roomId, content, senderName }) => {
    const normalizedRoomId = roomId?.trim().toLowerCase();
    const messageData = { 
      senderId: socket.id, 
      senderName: senderName || 'Anonymous', 
      content,
      timestamp: new Date()
    };
    io.to(normalizedRoomId).emit('chat-message', messageData);

    // Persist to DB for MOM
    try {
      await Session.findOneAndUpdate(
        { inviteLink: normalizedRoomId },
        { $push: { chatMessages: { senderName: messageData.senderName, content: messageData.content } } }
      );
    } catch (e) { console.error('Chat save error:', e); }
  });

  // Transcript Relay
  socket.on('transcript-update', async ({ roomId, sender, text }) => {
    try {
      await Session.findOneAndUpdate(
        { inviteLink: roomId },
        { $push: { transcript: { sender, text, timestamp: new Date() } } }
      );
    } catch (e) { console.error('Transcript save error:', e); }
  });

  // --- AI Interview Events ---
  socket.on('start_interview', ({ interviewId }) => {
    socket.join(`interview_${interviewId}`);
    console.log(`🎤 Interview session started: ${interviewId}`);
  });

  socket.on('candidate_answer', ({ interviewId, answer }) => {
    // This can be used for real-time transcription/typing indicators
    socket.to(`interview_${interviewId}`).emit('candidate_typing', { isTyping: true });
  });

  socket.on('disconnect', () => {
    const userData = users[socket.id];
    if (userData) {
      const { roomId, name } = userData;
      socket.to(roomId).emit('user-left', socket.id);
      delete users[socket.id];
      console.log(`🔴 User ${name} (${socket.id}) disconnected`);
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 [GLOBAL ERROR]:", err.stack);
  res.status(500).json({ 
    message: "Something went wrong on the server!", 
    error: err.message 
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 GDVerse Real-time Server running on port ${PORT}`);
});
