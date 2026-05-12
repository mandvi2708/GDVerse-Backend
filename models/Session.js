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
  duration: {
    type: String,
    default: '30 mins'
  },
  title: {
    type: String,
    default: 'New Discussion'
  },
  description: {
    type: String,
    default: 'A collaborative session'
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
  },
  transcript: [
    {
      sender: String,
      text: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  chatMessages: [
    {
      senderName: String,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  isInterviewMode: {
    type: Boolean,
    default: false
  },
  isImmediate: {
    type: Boolean,
    default: false
  },
  jobDescription: {
    type: String,
    default: ""
  },
  minutesOfMeeting: {
    type: String,
    default: ""
  },
  chatEnabled: {
    type: Boolean,
    default: true
  },
  userAssessments: [
    {
      userName: String,
      feedback: String,
      clarityScore: Number,
      confidenceScore: Number,
      technicalScore: Number,
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
