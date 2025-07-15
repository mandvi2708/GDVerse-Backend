const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
// const aiRoutes = require('./routes/aiRoutes'); // 🧠

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ✅ This will pick up Railway-assigned port or default to 5000 locally
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
// app.use('/api/ai', aiRoutes); // 🧠 AI Summary

// ✅ ALL socket.on() code MUST go inside this block
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

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
    io.emit('user-left', socket.id);
  });
});

// MongoDB Connection + Server Start
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });
