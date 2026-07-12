const express = require('express');
const router = express.Router();
const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');
const verifyStudent = require('../middleware/verifyStudent');
const verifyAdmin = require('../middleware/verifyAdmin');

// ─── STUDENT ROUTES ───────────────────────────────────────────────────────────

// POST /api/attempts — submit an attempt
router.post('/', verifyStudent, async (req, res) => {
  try {
    const { quizId, answers, timeTakenSeconds, autoSubmitted } = req.body;

    if (!quizId || !answers || timeTakenSeconds === undefined) {
      return res.status(400).json({ message: 'quizId, answers, and timeTakenSeconds are required.' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Build detailed answers by cross-referencing the quiz's correctAnswer
    const detailedAnswers = answers.map(({ questionText, selectedAnswer }) => {
      const question = quiz.questions.find(q => q.questionText === questionText);
      const correctAnswer = question ? question.correctAnswer : '';
      const isCorrect = selectedAnswer === correctAnswer;
      return { questionText, selectedAnswer, correctAnswer, isCorrect };
    });

    const correctCount = detailedAnswers.filter(a => a.isCorrect).length;
    // Wrong = answered incorrectly (blank/unanswered answers are NOT penalised)
    const wrongCount = detailedAnswers.filter(a => !a.isCorrect && a.selectedAnswer !== '').length;

    const penalty = quiz.negativeMarkingPoints || 0;
    const negativeMarksDeducted = parseFloat((wrongCount * penalty).toFixed(4));
    const rawScore = correctCount - negativeMarksDeducted;
    const score = Math.max(0, parseFloat(rawScore.toFixed(4))); // never below 0

    const attempt = new Attempt({
      studentId: req.user.id,
      quizId,
      answers: detailedAnswers,
      score,
      negativeMarksDeducted,
      totalQuestions: quiz.questions.length,
      timeTakenSeconds,
      autoSubmitted: autoSubmitted || false
    });

    await attempt.save();
    res.status(201).json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/attempts/my — get current student's full attempt history
router.get('/my', verifyStudent, async (req, res) => {
  try {
    const attempts = await Attempt.find({ studentId: req.user.id })
      .populate('quizId', 'title durationMinutes')
      .sort({ submittedAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/attempts/my/:attemptId — get specific attempt with full answer review
router.get('/my/:attemptId', verifyStudent, async (req, res) => {
  try {
    const attempt = await Attempt.findOne({ _id: req.params.attemptId, studentId: req.user.id })
      .populate('quizId', 'title durationMinutes');
    if (!attempt) return res.status(404).json({ message: 'Attempt not found.' });
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// GET /api/attempts/admin/all — all attempts across all students
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const attempts = await Attempt.find()
      .populate('studentId', 'name email')
      .populate('quizId', 'title')
      .sort({ submittedAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/attempts/admin/quiz/:quizId — analytics for a specific quiz
router.get('/admin/quiz/:quizId', verifyAdmin, async (req, res) => {
  try {
    const attempts = await Attempt.find({ quizId: req.params.quizId })
      .populate('studentId', 'name email')
      .sort({ submittedAt: -1 });

    if (attempts.length === 0) return res.json({ attempts: [], analytics: null });

    const totalAttempts = attempts.length;
    const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts;
    const autoSubmittedCount = attempts.filter(a => a.autoSubmitted).length;

    // Question difficulty: count wrong answers per question
    const questionStats = {};
    attempts.forEach(attempt => {
      attempt.answers.forEach(ans => {
        if (!questionStats[ans.questionText]) {
          questionStats[ans.questionText] = { correct: 0, wrong: 0, total: 0 };
        }
        questionStats[ans.questionText].total++;
        if (ans.isCorrect) questionStats[ans.questionText].correct++;
        else questionStats[ans.questionText].wrong++;
      });
    });

    const questionDifficulty = Object.entries(questionStats).map(([text, stats]) => ({
      questionText: text,
      ...stats,
      missRate: ((stats.wrong / stats.total) * 100).toFixed(1)
    })).sort((a, b) => b.wrong - a.wrong);

    res.json({
      attempts,
      analytics: { totalAttempts, avgScore: avgScore.toFixed(2), autoSubmittedCount, questionDifficulty }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/attempts/admin/overview — overview analytics for admin dashboard
router.get('/admin/overview', verifyAdmin, async (req, res) => {
  try {
    const attempts = await Attempt.find()
      .populate('quizId', 'title')
      .populate('studentId', 'name email');

    const totalAttempts = attempts.length;
    const uniqueStudents = new Set(attempts.map(a => a.studentId?._id?.toString())).size;
    const avgScore = totalAttempts > 0
      ? (attempts.reduce((sum, a) => sum + (a.score / a.totalQuestions) * 100, 0) / totalAttempts).toFixed(1)
      : 0;

    // Per-quiz stats
    const quizMap = {};
    attempts.forEach(a => {
      const quizId = a.quizId?._id?.toString();
      const quizTitle = a.quizId?.title || 'Unknown';
      if (!quizMap[quizId]) quizMap[quizId] = { title: quizTitle, attempts: 0, scoreSum: 0 };
      quizMap[quizId].attempts++;
      quizMap[quizId].scoreSum += (a.score / a.totalQuestions) * 100;
    });

    const perQuizStats = Object.entries(quizMap).map(([id, data]) => ({
      quizId: id,
      title: data.title,
      attempts: data.attempts,
      avgScore: (data.scoreSum / data.attempts).toFixed(1)
    })).sort((a, b) => b.attempts - a.attempts);

    res.json({ totalAttempts, uniqueStudents, avgScore, perQuizStats });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
