const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [
    {
      questionText: { type: String, required: true },
      selectedAnswer: { type: String, required: true },
      correctAnswer: { type: String, required: true },
      isCorrect: { type: Boolean, required: true }
    }
  ],
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  timeTakenSeconds: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now },
  autoSubmitted: { type: Boolean, default: false }
});

module.exports = mongoose.model('Attempt', attemptSchema);
