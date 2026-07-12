const express = require('express');
const router = express.Router();
const multer = require('multer');
const https = require('https');
const Quiz = require('../models/Quiz');
const verifyAdmin = require('../middleware/verifyAdmin');

// Multer: memory storage, PDF only, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  }
});

// Helper: call Gemini API with inline base64 PDF
const callGeminiWithPdf = (base64Data, mimeType, prompt) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reject(new Error('GEMINI_API_KEY is not set on the server.'));
    }

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
};

// POST /api/generate/from-pdf
router.post('/from-pdf', verifyAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file.' });
    }

    const { title, durationMinutes, folderIds } = req.body;

    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Quiz title and duration are required.' });
    }

    const base64Pdf = req.file.buffer.toString('base64');

    const prompt = `You are an expert quiz extractor. Extract ALL multiple-choice questions from this PDF document.

STRICT RULES:
1. Return ONLY valid JSON — no markdown, no prose, no code blocks, no explanation.
2. Do NOT determine or guess the correct answer. Leave correct answers completely out.
3. Each question MUST have at least 2 options and at most 6 options.
4. Detect the language of each question (e.g. "English", "Hindi", "Gujarati", etc.) and include it in the language field.
5. If the question has an image or diagram that cannot be extracted, skip it.

Return this EXACT JSON structure:
{
  "questions": [
    {
      "questionText": "full question text here",
      "options": ["option A text", "option B text", "option C text", "option D text"],
      "language": "English"
    }
  ]
}`;

    let geminiResponse;
    try {
      geminiResponse = await callGeminiWithPdf(base64Pdf, 'application/pdf', prompt);
    } catch (err) {
      return res.status(503).json({ message: 'Failed to reach AI service. Please check your connection and try again.' });
    }

    // Handle Gemini API errors
    if (geminiResponse.statusCode === 429) {
      return res.status(429).json({ message: 'AI service is busy (rate limited). Please wait a moment and try again.' });
    }
    if (geminiResponse.statusCode === 400) {
      return res.status(400).json({ message: 'The PDF could not be processed by the AI. It may be scanned/image-only or corrupted.' });
    }
    if (geminiResponse.statusCode === 403 || geminiResponse.statusCode === 401) {
      return res.status(500).json({ message: 'Gemini API key is invalid or not authorized. Please check the GEMINI_API_KEY environment variable on Render.' });
    }
    if (geminiResponse.statusCode !== 200) {
      let geminiErr = '';
      try { geminiErr = JSON.parse(geminiResponse.body)?.error?.message || geminiResponse.body?.slice(0, 200); } catch {}
      console.error('Gemini unexpected error:', geminiResponse.statusCode, geminiResponse.body);
      return res.status(500).json({ message: `AI error (${geminiResponse.statusCode}): ${geminiErr || 'Please try again.'}` });
    }

    // Parse Gemini response
    let geminiData;
    try {
      geminiData = JSON.parse(geminiResponse.body);
    } catch {
      return res.status(500).json({ message: 'Could not parse AI response. Please try again.' });
    }

    // Extract the text content from Gemini's response structure
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return res.status(500).json({ message: 'AI returned an empty response. The PDF may have no extractable text.' });
    }

    // Parse the JSON returned by Gemini
    let extractedData;
    try {
      // Strip any accidental markdown wrapping (```json ... ```)
      const cleaned = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({
        message: 'AI did not return valid JSON. This can happen with complex or image-heavy PDFs. Please try a text-based PDF.',
        rawResponse: textContent.substring(0, 500)
      });
    }

    // Validate structure
    if (!extractedData.questions || !Array.isArray(extractedData.questions) || extractedData.questions.length === 0) {
      return res.status(422).json({ message: 'No questions could be extracted from this PDF. Please check the file content.' });
    }

    // Filter and validate individual questions
    const validQuestions = extractedData.questions.filter(q => {
      return (
        q.questionText &&
        typeof q.questionText === 'string' &&
        q.questionText.trim() &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every(o => typeof o === 'string' && o.trim())
      );
    }).map(q => ({
      questionText: q.questionText.trim(),
      options: q.options.map(o => o.trim()),
      language: q.language || 'English',
      correctAnswer: '' // deliberately empty — set by admin self-attempt
    }));

    if (validQuestions.length === 0) {
      return res.status(422).json({ message: 'All extracted questions failed validation. Please check the PDF format.' });
    }

    // Parse folderIds
    let parsedFolderIds = [];
    if (folderIds) {
      try {
        parsedFolderIds = typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds;
      } catch {
        parsedFolderIds = [];
      }
    }

    // Save as draft quiz
    const quiz = new Quiz({
      title: title.trim(),
      durationMinutes: parseInt(durationMinutes, 10),
      questions: validQuestions,
      isPublished: false,
      isDraft: true,
      folderIds: parsedFolderIds,
      createdBy: req.user.id
    });

    await quiz.save();

    // Determine if extraction might be incomplete (< 3 questions for a substantial file)
    const pageSizeEstimate = req.file.size / 50000; // rough estimate: 50KB per page
    const lowExtractionWarning = validQuestions.length < 3 && pageSizeEstimate > 2;

    res.status(201).json({
      quiz,
      extractedCount: validQuestions.length,
      warning: lowExtractionWarning
        ? `Only ${validQuestions.length} question(s) were extracted from a potentially multi-page PDF. The PDF may be image-based or low quality.`
        : null
    });

  } catch (err) {
    if (err.message === 'Only PDF files are allowed.') {
      return res.status(400).json({ message: 'Only PDF files are accepted.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'PDF file is too large. Maximum size is 10MB.' });
    }
    console.error('Generate from PDF error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
