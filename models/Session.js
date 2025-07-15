const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  aiCount: {
    type: Number,
    required: true
  },
  humanCount: {
    type: Number,
    required: true
  },
  inviteLink: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
