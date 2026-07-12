const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const verifyStudent = require('../middleware/verifyStudent');
const verifyAdmin = require('../middleware/verifyAdmin');

// ─── STUDENT ROUTES ───────────────────────────────────────────────────────────

// GET /api/quizzes — list all published quizzes (no correct answers)
router.get('/', verifyStudent, async (req, res) => {
  try {
    const { folder } = req.query;
    const filter = { isPublished: true };
    if (folder && folder !== 'all') {
      filter.folderIds = folder;
    }

    const quizzes = await Quiz.find(filter)
      .populate('folderIds', 'name')
      .select('title description durationMinutes questions createdAt folderIds negativeMarkingPoints')
      .lean();

    // Strip correctAnswer from questions
    const safeQuizzes = quizzes.map(q => ({
      ...q,
      questions: q.questions.map(({ questionText, options, _id }) => ({ _id, questionText, options })),
      questionCount: q.questions.length
    }));

    res.json(safeQuizzes);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/quizzes/:id — get a single published quiz to take (no correct answers)
router.get('/:id', verifyStudent, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, isPublished: true }).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    const safeQuiz = {
      ...quiz,
      questions: quiz.questions.map(({ questionText, options, _id }) => ({ _id, questionText, options }))
    };

    res.json(safeQuiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// GET /api/quizzes/admin/all — all quizzes including drafts
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate('folderIds', 'name').lean();
    const quizzesWithCount = quizzes.map(q => ({ ...q, questionCount: q.questions.length }));
    res.json(quizzesWithCount);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/quizzes/admin/:id — get a single quiz with correct answers (admin)
router.get('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('folderIds', 'name');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/quizzes — create quiz
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { title, description, durationMinutes, questions, isPublished, negativeMarkingPoints, folderIds } = req.body;

    if (!title || !durationMinutes || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, duration, and at least one question are required.' });
    }

    const quiz = new Quiz({
      title,
      description,
      durationMinutes,
      questions,
      isPublished: isPublished || false,
      negativeMarkingPoints: negativeMarkingPoints || 0,
      folderIds: folderIds || [],
      createdBy: req.user.id
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/quizzes/:id — update quiz
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { title, description, durationMinutes, questions, isPublished, negativeMarkingPoints, folderIds } = req.body;

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    if (title !== undefined) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (durationMinutes !== undefined) quiz.durationMinutes = durationMinutes;
    if (questions !== undefined) quiz.questions = questions;
    if (isPublished !== undefined) quiz.isPublished = isPublished;
    if (negativeMarkingPoints !== undefined) quiz.negativeMarkingPoints = negativeMarkingPoints;
    if (folderIds !== undefined) quiz.folderIds = folderIds;
    quiz.updatedAt = new Date();

    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/quizzes/:id — delete quiz
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    res.json({ message: 'Quiz deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
