const Session = require('../models/Session');
const jwt = require('jsonwebtoken');

// 🔗 Utility to generate a unique invite link
const generateInviteLink = () => {
  return `gd-session-${Math.random().toString(36).substring(2, 10)}`;
};

// ✅ 1. Create a new GD session
exports.createSession = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No authorization header provided' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
    }

    let { date, time, duration, title, description, aiCount, humanCount, isImmediate, isInterviewMode, jobDescription } = req.body;

    if (isImmediate) {
      const now = new Date();
      date = now.toISOString().split('T')[0];
      time = now.toTimeString().split(' ')[0].substring(0, 5);
    }

    if (!date || !time) {
      return res.status(400).json({ message: 'Please select a valid date and time' });
    }

    // Defensive defaults for counts
    const finalAiCount = isInterviewMode ? 1 : (Number(aiCount) || 0);
    const finalHumanCount = Number(humanCount) || 2;

    const inviteLink = generateInviteLink();

    const session = await Session.create({
      creator: decoded.id,
      date,
      time,
      duration: duration || '30 mins',
      title: title || 'New Discussion',
      description: description || 'A collaborative session',
      aiCount: finalAiCount,
      humanCount: finalHumanCount,
      isInterviewMode: !!isInterviewMode,
      jobDescription: jobDescription || "",
      inviteLink,
    });

    res.status(201).json(session);
  } catch (err) {
    console.error('BACKEND CREATE SESSION ERROR:', err);
    res.status(500).json({ message: 'Database error while creating session', error: err.message });
  }
};

// ✅ 2. Get all sessions created by the logged-in user
exports.getUserSessions = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sessions = await Session.find({ creator: decoded.id })
      .populate('creator', 'name')
      .sort({ createdAt: -1 });

    const io = req.app.get('io');
    const sessionsWithRealTime = sessions.map(session => {
      let realTimeHumans = 0;
      if (io && session.inviteLink) {
         const room = io.sockets.adapter.rooms.get(session.inviteLink.toLowerCase());
         realTimeHumans = room ? room.size : 0;
      }
      return { ...session.toObject(), realTimeHumans };
    });

    res.status(200).json(sessionsWithRealTime);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 3. Delete a session by ID
exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await Session.findByIdAndDelete(id);
    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 4. Get a session by invite link (for /session/:inviteLink)
exports.getSessionByInviteLink = async (req, res) => {
  try {
    const { inviteLink } = req.params;
    const session = await Session.findOne({ inviteLink }).populate('creator', 'name');

    if (!session) return res.status(404).json({ message: 'Session not found' });

    res.status(200).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 5. Get ALL sessions (for the global dashboard)
exports.getAllSessions = async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate('creator', 'name')
      .sort({ createdAt: -1 });

    const io = req.app.get('io');
    const sessionsWithRealTime = sessions.map(session => {
      let realTimeHumans = 0;
      if (io && session.inviteLink) {
         const room = io.sockets.adapter.rooms.get(session.inviteLink.toLowerCase());
         realTimeHumans = room ? room.size : 0;
      }
      return { ...session.toObject(), realTimeHumans };
    });

    res.status(200).json(sessionsWithRealTime);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
