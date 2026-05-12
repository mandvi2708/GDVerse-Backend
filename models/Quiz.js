const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  topic: { type: String, required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  questions: [
    {
      question: String,
      options: [String],
      correctAnswer: Number, // Index of correct option
      explanation: String
    }
  ],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  results: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      score: Number,
      totalQuestions: Number,
      accuracy: Number,
      averageSpeed: Number,
      readinessLevel: String,
      topicBreakdown: Map,
      completedAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Quiz', QuizSchema);
