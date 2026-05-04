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
// ✅ MANUAL CORS OVERRIDE (The "Nuclear Option")
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // If the request comes from your Vercel site or localhost, approve it exactly as is
  if (origin && (origin.includes('vercel.app') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback to your primary production URL
    res.header('Access-Control-Allow-Origin', 'https://gd-verse-frontend.vercel.app');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Instantly handle preflight requests
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
    origin: true,
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
