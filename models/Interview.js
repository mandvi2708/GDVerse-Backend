const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
  candidateInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    jobRole: { type: String, required: true },
    yearsExperience: { type: Number, required: true },
    resumeText: { type: String, required: true },
    jdText: { type: String, default: "" },
  },
  status: {
    type: String,
    enum: ['setup', 'ongoing', 'completed', 'cancelled'],
    default: 'setup'
  },
  stage: {
    type: String,
    enum: ['Introduction', 'Technical', 'Behavioral', 'Conclusion'],
    default: 'Introduction'
  },
  conversation: [
    {
      role: { type: String, enum: ['ai', 'candidate'] },
      content: { type: String },
      evaluation: {
        score: { type: Number },
        feedback: { type: String },
        isFollowUp: { type: Boolean, default: false }
      },
      stage: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  analytics: {
    technical: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    resumeStrength: { type: Number, default: 0 }
  },
  finalReport: {
    overallScore: { type: Number },
    strengths: [String],
    weaknesses: [String],
    improvementSuggestions: [String],
    aiSummary: { type: String },
    categoryScores: {
      technical: Number,
      communication: Number,
      confidence: Number,
      problemSolving: Number,
      resumeStrength: Number
    }
  },
  shareLink: { type: String, unique: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Interview', InterviewSchema);
