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
      .select('title description durationMinutes questions createdAt folderIds negativeMarking negativeMarkingPoints shuffleQuestions shuffleOptions allowMultipleAttempts showCorrectAnswersAfterSubmit randomizeQuestionSubset subsetSize')
      .lean();

    // Strip correctAnswer from questions and compute correct question count (respect subset)
    const safeQuizzes = quizzes.map(q => {
      const actualCount = q.randomizeQuestionSubset && q.subsetSize > 0 && q.subsetSize < q.questions.length
        ? q.subsetSize
        : q.questions.length;
      return {
        ...q,
        questions: q.questions.map(({ questionText, options, _id }) => ({ _id, questionText, options })),
        questionCount: actualCount
      };
    });

    res.json(safeQuizzes);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// Helper for shuffling arrays
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// GET /api/quizzes/:id — get a single published quiz to take (no correct answers)
router.get('/:id', verifyStudent, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, isPublished: true }).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    // Block repeat attempts if allowMultipleAttempts is false
    if (!quiz.allowMultipleAttempts) {
      const existingAttempt = await Attempt.findOne({ studentId: req.user.id, quizId: req.params.id });
      if (existingAttempt) {
        return res.status(403).json({
          alreadyAttempted: true,
          attemptId: existingAttempt._id,
          message: "You've already attempted this quiz."
        });
      }
    }

    let questionsToDeliver = quiz.questions;
    
    // Add indices to preserve order if randomizeQuestionSubset is true but shuffleQuestions is false
    const indexedQuestions = questionsToDeliver.map((q, idx) => ({ ...q, originalIdx: idx }));

    const shouldShuffleQuestions = quiz.shuffleQuestions !== false;
    const shouldShuffleOptions = quiz.shuffleOptions !== false;

    if (quiz.randomizeQuestionSubset && quiz.subsetSize > 0 && quiz.subsetSize < questionsToDeliver.length) {
      const shuffledForSubset = shuffleArray(indexedQuestions);
      let selectedSubset = shuffledForSubset.slice(0, quiz.subsetSize);
      
      if (!shouldShuffleQuestions) {
        selectedSubset.sort((a, b) => a.originalIdx - b.originalIdx);
      }
      questionsToDeliver = selectedSubset;
    } else {
      questionsToDeliver = indexedQuestions;
    }

    if (shouldShuffleQuestions) {
      questionsToDeliver = shuffleArray(questionsToDeliver);
    }

    const safeQuestions = questionsToDeliver.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: shouldShuffleOptions ? shuffleArray(q.options) : q.options,
      imageUrl: q.imageUrl || '',
      allowMultipleCorrect: q.allowMultipleCorrect || false,
      isBonusQuestion: q.isBonusQuestion || false,
      marksWeight: q.marksWeight !== undefined ? q.marksWeight : 1,
      isOptional: q.isOptional || false
    }));

    const safeQuiz = {
      ...quiz,
      questions: safeQuestions
    };

    res.json(safeQuiz);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Multer memory storage for image uploads (max 5MB, JPG/PNG/WEBP only)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP images are allowed.'));
    }
  }
}).single('image');

// POST /api/quizzes/admin/upload-image — upload an image to Cloudinary (admin only)
router.post('/admin/upload-image', verifyAdmin, (req, res) => {
  imageUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Stream the file buffer directly to Cloudinary
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'quiz_images' },
      (error, result) => {
        if (error) {
          return res.status(500).json({ message: 'Cloudinary upload failed.', error: error.message });
        }
        res.status(200).json({ imageUrl: result.secure_url });
      }
    );
    stream.end(req.file.buffer);
  });
});

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
    const {
      title, description, durationMinutes, questions, isPublished, folderIds,
      negativeMarking, negativeMarkingPoints, shuffleQuestions, shuffleOptions,
      allowMultipleAttempts, showCorrectAnswersAfterSubmit, randomizeQuestionSubset, subsetSize
    } = req.body;

    if (!title || !durationMinutes || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, duration, and at least one question are required.' });
    }

    const quiz = new Quiz({
      title,
      description,
      durationMinutes,
      questions,
      isPublished: isPublished || false,
      folderIds: folderIds || [],
      negativeMarking: negativeMarking !== undefined ? negativeMarking : false,
      negativeMarkingPoints: negativeMarkingPoints || 0,
      shuffleQuestions: shuffleQuestions !== undefined ? shuffleQuestions : true,
      shuffleOptions: shuffleOptions !== undefined ? shuffleOptions : true,
      allowMultipleAttempts: allowMultipleAttempts !== undefined ? allowMultipleAttempts : false,
      showCorrectAnswersAfterSubmit: showCorrectAnswersAfterSubmit !== undefined ? showCorrectAnswersAfterSubmit : true,
      randomizeQuestionSubset: randomizeQuestionSubset !== undefined ? randomizeQuestionSubset : false,
      subsetSize: subsetSize || 0,
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
    const {
      title, description, durationMinutes, questions, isPublished, folderIds,
      negativeMarking, negativeMarkingPoints, shuffleQuestions, shuffleOptions,
      allowMultipleAttempts, showCorrectAnswersAfterSubmit, randomizeQuestionSubset, subsetSize
    } = req.body;

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    if (title !== undefined) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (durationMinutes !== undefined) quiz.durationMinutes = durationMinutes;
    if (questions !== undefined) quiz.questions = questions;
    if (isPublished !== undefined) quiz.isPublished = isPublished;
    if (folderIds !== undefined) quiz.folderIds = folderIds;
    if (negativeMarking !== undefined) quiz.negativeMarking = negativeMarking;
    if (negativeMarkingPoints !== undefined) quiz.negativeMarkingPoints = negativeMarkingPoints;
    if (shuffleQuestions !== undefined) quiz.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions !== undefined) quiz.shuffleOptions = shuffleOptions;
    if (allowMultipleAttempts !== undefined) quiz.allowMultipleAttempts = allowMultipleAttempts;
    if (showCorrectAnswersAfterSubmit !== undefined) quiz.showCorrectAnswersAfterSubmit = showCorrectAnswersAfterSubmit;
    if (randomizeQuestionSubset !== undefined) quiz.randomizeQuestionSubset = randomizeQuestionSubset;
    if (subsetSize !== undefined) quiz.subsetSize = subsetSize;
    
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

    const { newOnly } = req.query;
    let questionsToReturn = quiz.questions;
    const answeredCount = quiz.questions.filter(q => q.correctAnswer && q.correctAnswer.trim() !== '').length;

    if (newOnly === 'true') {
      questionsToReturn = quiz.questions.filter(q => !q.correctAnswer || q.correctAnswer.trim() === '');
    }

    // Strip correctAnswer/correctAnswers/explanationText — admin will be setting them fresh
    const safeQuiz = {
      ...quiz,
      questions: questionsToReturn.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
        imageUrl: q.imageUrl || '',
        allowMultipleCorrect: q.allowMultipleCorrect || false,
        partialCreditForMultiCorrect: q.partialCreditForMultiCorrect || false,
        isBonusQuestion: q.isBonusQuestion || false,
        marksWeight: q.marksWeight !== undefined ? q.marksWeight : 1,
        isOptional: q.isOptional || false,
        language: q.language || 'English'
      })),
      totalQuestionsCount: quiz.questions.length,
      answeredQuestionsCount: answeredCount
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

    answers.forEach(({ questionId, correctAnswer, correctAnswers }) => {
      const q = quiz.questions.id(questionId);
      if (q) {
        if (correctAnswers && Array.isArray(correctAnswers)) {
          q.correctAnswers = correctAnswers;
          q.correctAnswer = correctAnswers.length > 0 ? correctAnswers[0] : '';
        } else if (correctAnswer) {
          q.correctAnswer = correctAnswer;
          q.correctAnswers = [correctAnswer];
        }
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

    // Verify all non-bonus questions have a correct answer set
    const unanswered = quiz.questions.filter(q => 
      !q.isBonusQuestion && 
      (!q.correctAnswer || !q.correctAnswer.trim()) && 
      (!q.correctAnswers || q.correctAnswers.length === 0)
    );
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

