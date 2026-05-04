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
// Allow requests from frontend localhost and production Vercel URL
app.use(cors({
  origin: function (origin, callback) {
    // Reflect the exact origin back to the client if it's from Vercel or Localhost
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// ✅ ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes); // 🧠 AI Summary

// ✅ CREATE HTTP SERVER
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
        callback(null, origin);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ SOCKET.IO EVENTS
io.on('connection', (socket) => {
  console.log('🟢 New user connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('signal', ({ targetId, signal }) => {
    io.to(targetId).emit('signal', { senderId: socket.id, signal });
  });

  socket.on('chat-message', (data) => {
    socket.broadcast.emit('chat-message', data);
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

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
    io.emit('user-left', socket.id);
  });
});

// ✅ MONGODB CONNECTION
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));
