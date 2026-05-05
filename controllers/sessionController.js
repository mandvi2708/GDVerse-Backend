const Session = require('../models/Session');
const jwt = require('jsonwebtoken');

// 🔗 Utility to generate a unique invite link
const generateInviteLink = () => {
  return `gd-session-${Math.random().toString(36).substring(2, 10)}`;
};

// ✅ 1. Create a new GD session
exports.createSession = async (req, res) => {
  try {
    console.log('🔁 Incoming session creation request...');

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized - Token missing' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', decoded);

    const { date, time, aiCount, humanCount } = req.body;

    if (!date || !time || aiCount === undefined || humanCount === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const inviteLink = generateInviteLink();

    const session = await Session.create({
      creator: decoded.id,
      date,
      time,
      aiCount,
      humanCount,
      inviteLink,
    });

    console.log('✅ Session created:', session);
    res.status(201).json(session);
  } catch (err) {
    console.error('❌ Error creating session:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ✅ 2. Get all sessions created by the logged-in user
exports.getUserSessions = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sessions = await Session.find({ creator: decoded.id }).sort({ createdAt: -1 });

    res.status(200).json(sessions);
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

    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
