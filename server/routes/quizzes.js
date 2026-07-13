const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const User = require('../models/User');
const verifyStudent = require('../middleware/verifyStudent');
const verifyAdmin = require('../middleware/verifyAdmin');

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

// GET /api/quizzes/:quizId/leaderboard — ranked student standings for a quiz
router.get('/:quizId/leaderboard', verifyStudent, async (req, res) => {
  try {
    const { quizId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const quiz = await Quiz.findById(quizId).select('title').lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Aggregation: best attempt per student, sorted by score desc, time asc
    const pipeline = [
      { $match: { quizId: require('mongoose').Types.ObjectId.createFromHexString(quizId) } },
      { $sort: { score: -1, timeTakenSeconds: 1, submittedAt: 1 } },
      {
        $group: {
          _id: '$studentId',
          score: { $first: '$score' },
          totalQuestions: { $first: '$totalQuestions' },
          totalMarks: { $first: '$totalMarks' },
          timeTakenSeconds: { $first: '$timeTakenSeconds' },
          submittedAt: { $first: '$submittedAt' },
          attemptId: { $first: '$_id' }
        }
      },
      { $sort: { score: -1, timeTakenSeconds: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          studentId: '$_id',
          studentName: '$userInfo.name',
          score: 1,
          totalQuestions: 1,
          totalMarks: 1,
          timeTakenSeconds: 1,
          submittedAt: 1,
          attemptId: 1
        }
      }
    ];

    const allRanked = await Attempt.aggregate(pipeline);
    const totalStudents = allRanked.length;

    // Assign ranks (1-indexed)
    const rankedList = allRanked.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
      percentile: totalStudents > 0 ? parseFloat((((totalStudents - (idx + 1)) / totalStudents) * 100).toFixed(1)) : 0,
      percentage: entry.totalQuestions > 0 ? parseFloat(((entry.score / entry.totalQuestions) * 100).toFixed(1)) : 0
    }));

    // Find current student's rank
    const myEntry = rankedList.find(e => e.studentId.toString() === req.user.id);

    // Paginate
    const start = (page - 1) * limit;
    const paginatedList = rankedList.slice(start, start + limit);

    res.json({
      quizTitle: quiz.title,
      totalStudents,
      leaderboard: paginatedList,
      myRank: myEntry?.rank || null,
      myPercentile: myEntry?.percentile ?? null,
      myScore: myEntry?.score ?? null,
      myTimeTaken: myEntry?.timeTakenSeconds ?? null,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalStudents / limit),
        hasMore: start + limit < totalStudents
      }
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

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

// GET /api/quizzes/admin/:id/for-answer-key — get draft quiz for admin self-attempt (NO correctAnswer exposed)
router.get('/admin/:id/for-answer-key', verifyAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Strip correctAnswer — admin will be setting them fresh
    const safeQuiz = {
      ...quiz,
      questions: quiz.questions.map(({ questionText, options, language, _id }) => ({
        _id,
        questionText,
        options,
        language: language || 'English'
      }))
    };

    res.json(safeQuiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/quizzes/:id/set-answer-key — admin sets correct answers after self-attempt
router.post('/:id/set-answer-key', verifyAdmin, async (req, res) => {
  try {
    const { answers, updatedQuestions } = req.body;
    // answers: [{ questionId, correctAnswer }]
    // updatedQuestions (optional): [{ _id, questionText, options }] — if admin edited questions

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Apply any edits to question text/options first
    if (updatedQuestions && Array.isArray(updatedQuestions)) {
      updatedQuestions.forEach(updQ => {
        const q = quiz.questions.id(updQ._id);
        if (q) {
          if (updQ.questionText) q.questionText = updQ.questionText.trim();
          if (updQ.options) q.options = updQ.options.map(o => o.trim());
        }
      });
    }

    // Apply correct answers
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'answers array is required.' });
    }

    answers.forEach(({ questionId, correctAnswer }) => {
      const q = quiz.questions.id(questionId);
      if (q && correctAnswer) {
        q.correctAnswer = correctAnswer;
      }
    });

    quiz.updatedAt = new Date();
    await quiz.save();

    res.json({ message: 'Answer key saved successfully.', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/quizzes/:id/publish — finalize and publish a draft quiz
router.post('/:id/publish', verifyAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Verify all questions have a correct answer set
    const unanswered = quiz.questions.filter(q => !q.correctAnswer || !q.correctAnswer.trim());
    if (unanswered.length > 0) {
      return res.status(400).json({
        message: `${unanswered.length} question(s) still have no correct answer set. Please complete the answer key before publishing.`
      });
    }

    quiz.isPublished = true;
    quiz.isDraft = false;
    quiz.updatedAt = new Date();
    await quiz.save();

    res.json({ message: 'Quiz published successfully!', quiz });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;

