const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: false, default: '' }, // Optional for AI-generated drafts
  language: { type: String, default: 'English' } // Language tag from NVIDIA NIM extraction
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  durationMinutes: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }],
  questions: [questionSchema],
  isPublished: { type: Boolean, default: false },
  isDraft: { type: Boolean, default: false }, // true for AI-generated quizzes pending answer-key setup
  negativeMarking: { type: Boolean, default: false },
  negativeMarkingPoints: { type: Number, default: 0, min: 0 },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  allowMultipleAttempts: { type: Boolean, default: false },
  showCorrectAnswersAfterSubmit: { type: Boolean, default: true },
  randomizeQuestionSubset: { type: Boolean, default: false },
  subsetSize: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema);
