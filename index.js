// index.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const aiRoutes = require('./routes/aiRoutes'); // 🧠 AI Summary
const Session = require('./models/Session'); // Required for transcript updates

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ EXPRESS MIDDLEWARE
// ✅ GLOBAL CORS OVERRIDE (The "Universal Fix")
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  next();
});

app.use(express.json());

// ✅ ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes); // 🧠 AI Summary

// ✅ CREATE HTTP SERVER
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ✅ SOCKET.IO EVENTS
io.on('connection', (socket) => {
  console.log('🟢 New user connected:', socket.id);

  socket.on('join-room', ({ roomId, name }) => {
    const normalizedRoomId = roomId?.trim().toLowerCase();
    if (!normalizedRoomId) return;

    socket.join(normalizedRoomId);
    socket.userName = name;
    socket.roomId = normalizedRoomId;

    // Get all other users in the room
    const usersInRoom = [];
    const clients = io.sockets.adapter.rooms.get(normalizedRoomId);
    if (clients) {
      clients.forEach(clientId => {
        if (clientId !== socket.id) {
          const clientSocket = io.sockets.sockets.get(clientId);
          usersInRoom.push({ userId: clientId, name: clientSocket?.userName || 'Anonymous' });
        }
      });
    }

    // 1. Tell the new user who is already there
    socket.emit('all-users', usersInRoom);

    // 2. Tell existing users that someone new joined
    socket.to(normalizedRoomId).emit('user-joined', { userId: socket.id, name });
    
    console.log(`User ${name} joined room ${normalizedRoomId}. Current peers:`, usersInRoom.map(u => u.name));
  });

  socket.on('signal', ({ targetId, signal }) => {
    io.to(targetId).emit('signal', { senderId: socket.id, signal });
  });

  socket.on('chat-message', ({ roomId, content, senderName }) => {
    const normalizedRoomId = roomId?.trim().toLowerCase();
    const messageData = { 
      senderId: socket.id, 
      senderName: senderName || 'Anonymous', 
      content,
      timestamp: new Date()
    };
    io.to(normalizedRoomId || roomId).emit('chat-message', messageData);
  });

  socket.on('transcript-update', async ({ roomId, sender, text }) => {
    try {
      await Session.findOneAndUpdate(
        { inviteLink: roomId },
        { 
          $push: { 
            transcript: { sender, text, timestamp: new Date() } 
          } 
        }
      );
    } catch (err) {
      console.error('Error updating transcript:', err);
    }
  });

  socket.on('disconnecting', () => {
    [...socket.rooms].forEach(roomId => {
      socket.to(roomId).emit('user-left', socket.id);
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ✅ MONGODB CONNECTION
console.log('Attempting to connect to MongoDB...');
const mongoURI = process.env.MONGO_URL;

if (!mongoURI) {
  console.error('❌ MONGO_URL is undefined! Please check your Render environment variables.');
  process.exit(1);
}

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });
