const express = require('express');
const router = express.Router();
const multer = require('multer');
const https = require('https');
const pdfParse = require('pdf-parse');
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

// Helper: call Gemini API with plain text (NOT base64 PDF — much lower token usage)
const callGeminiWithText = (textPrompt) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reject(new Error('GEMINI_API_KEY is not set on the server.'));
    }

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [{ text: textPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
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

    // ── Step 1: Extract text from PDF locally (no token cost) ──────────────────
    let pdfText = '';
    try {
      const pdfData = await pdfParse(req.file.buffer);
      pdfText = pdfData.text || '';
    } catch (err) {
      return res.status(400).json({ message: 'Could not read this PDF. It may be corrupted or password-protected.' });
    }

    if (!pdfText.trim() || pdfText.trim().length < 50) {
      return res.status(422).json({
        message: 'No readable text found in this PDF. It appears to be a scanned/image-only PDF. Please use a PDF with selectable text.'
      });
    }

    // Trim text to avoid exceeding token limits (keep first ~60,000 chars ≈ ~15,000 tokens)
    const trimmedText = pdfText.length > 60000 ? pdfText.slice(0, 60000) + '\n[...document continues...]' : pdfText;

    // ── Step 2: Send extracted TEXT to Gemini (tiny token usage) ───────────────
    const prompt = `You are an expert quiz extractor. The following is text extracted from a PDF exam paper.

Carefully read the text and extract ALL multiple-choice questions.

STRICT RULES:
1. Return ONLY valid JSON — no markdown, no prose, no code blocks, no explanation.
2. Do NOT determine or guess the correct answer. Leave correct answers completely out.
3. Each question MUST have at least 2 options and at most 6 options.
4. Detect the language of each question (e.g. "English", "Hindi", "Gujarati") and include it in the language field.
5. Clean up any OCR or formatting artifacts in question text.
6. Skip any questions that are incomplete or have no options.

Return this EXACT JSON structure:
{
  "questions": [
    {
      "questionText": "full question text here",
      "options": ["option A text", "option B text", "option C text", "option D text"],
      "language": "English"
    }
  ]
}

Here is the extracted PDF text:
---
${trimmedText}
---`;

    let geminiResponse;
    try {
      geminiResponse = await callGeminiWithText(prompt);
    } catch (err) {
      return res.status(503).json({ message: 'Failed to reach AI service. Please try again.' });
    }

    // Handle Gemini API errors
    if (geminiResponse.statusCode === 429) {
      let quotaDetail = '';
      try { quotaDetail = JSON.parse(geminiResponse.body)?.error?.message || ''; } catch {}
      console.warn('Gemini 429:', quotaDetail);
      return res.status(429).json({
        message: 'Gemini API quota exceeded. Please generate a new API key at aistudio.google.com/apikey and update GEMINI_API_KEY in Render.'
      });
    }
    if (geminiResponse.statusCode === 403 || geminiResponse.statusCode === 401) {
      return res.status(500).json({ message: 'Gemini API key is invalid. Please check GEMINI_API_KEY in Render Environment Variables.' });
    }
    if (geminiResponse.statusCode === 400) {
      return res.status(400).json({ message: 'Gemini could not process this request. Please try a different PDF.' });
    }
    if (geminiResponse.statusCode !== 200) {
      let geminiErr = '';
      try { geminiErr = JSON.parse(geminiResponse.body)?.error?.message || ''; } catch {}
      console.error('Gemini error:', geminiResponse.statusCode, geminiResponse.body);
      return res.status(500).json({ message: `AI error (${geminiResponse.statusCode}): ${geminiErr || 'Please try again.'}` });
    }

    // Parse Gemini response
    let geminiData;
    try {
      geminiData = JSON.parse(geminiResponse.body);
    } catch {
      return res.status(500).json({ message: 'Could not parse AI response. Please try again.' });
    }

    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return res.status(500).json({ message: 'AI returned an empty response. Please try again.' });
    }

    // Parse the JSON returned by Gemini
    let extractedData;
    try {
      const cleaned = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({
        message: 'AI response was not valid JSON. Please try again.',
        rawResponse: textContent.substring(0, 300)
      });
    }

    if (!extractedData.questions || !Array.isArray(extractedData.questions) || extractedData.questions.length === 0) {
      return res.status(422).json({ message: 'No questions could be extracted. Make sure the PDF contains multiple-choice questions.' });
    }

    // Validate and clean individual questions
    const validQuestions = extractedData.questions.filter(q =>
      q.questionText &&
      typeof q.questionText === 'string' &&
      q.questionText.trim() &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.every(o => typeof o === 'string' && o.trim())
    ).map(q => ({
      questionText: q.questionText.trim(),
      options: q.options.map(o => o.trim()),
      language: q.language || 'English',
      correctAnswer: ''
    }));

    if (validQuestions.length === 0) {
      return res.status(422).json({ message: 'All extracted questions failed validation. Check the PDF format.' });
    }

    // Parse folderIds
    let parsedFolderIds = [];
    if (folderIds) {
      try {
        parsedFolderIds = typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds;
      } catch { parsedFolderIds = []; }
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

    const lowExtractionWarning = validQuestions.length < 3 && pdfText.length > 2000;

    res.status(201).json({
      quiz,
      extractedCount: validQuestions.length,
      warning: lowExtractionWarning
        ? `Only ${validQuestions.length} question(s) extracted. The PDF may have complex formatting.`
        : null
    });

  } catch (err) {
    if (err.message === 'Only PDF files are allowed.') {
      return res.status(400).json({ message: 'Only PDF files are accepted.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'PDF is too large. Maximum size is 10MB.' });
    }
    console.error('Generate from PDF error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
