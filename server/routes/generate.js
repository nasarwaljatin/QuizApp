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
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  }
});

// Helper: classify Gemini API errors based on status code and response body
const classifyGeminiError = (statusCode, body) => {
  if (statusCode === 403 || statusCode === 401) {
    return { code: 'INVALID_KEY', message: 'Gemini API key is invalid or not authorized.' };
  }

  if (statusCode === 429) {
    let message = 'Rate limit or quota exceeded.';
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message || message;
    } catch (e) {}

    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('per day') || lowerMsg.includes('daily') || lowerMsg.includes('rpd')) {
      return { code: 'RATE_LIMIT_RPD', message };
    }
    if (lowerMsg.includes('token') || lowerMsg.includes('tpm') || lowerMsg.includes('tokens per minute')) {
      return { code: 'RATE_LIMIT_TPM', message };
    }
    // Default to RPM for transient requests rate limit
    return { code: 'RATE_LIMIT_RPM', message };
  }

  let genericMessage = `API Error ${statusCode}`;
  try {
    const parsed = JSON.parse(body);
    genericMessage = parsed?.error?.message || genericMessage;
  } catch (e) {}

  return { code: 'UNKNOWN_ERROR', message: genericMessage };
};

// Helper: wait N milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Shared Gemini caller ───────────────────────────────────────────────────────
const callGemini = (parts) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reject(new Error('GEMINI_API_KEY is not set on the server.'));

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
};

// Helper: call Gemini with automatic retry for transient limits (RPM/TPM)
const callGeminiWithRetry = async (parts) => {
  let attempt = 0;
  const maxRetries = 3;

  while (true) {
    let response;
    try {
      response = await callGemini(parts);
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`[Gemini Request Failure] Network error, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries}):`, err.message);
        await sleep(delay);
        continue;
      }
      throw err;
    }

    if (response.statusCode === 200) {
      return response;
    }

    const errorInfo = classifyGeminiError(response.statusCode, response.body);

    // Logging requirement:
    // Log the raw Gemini error response server-side (status code, error type, retry-after header if present)
    const retryAfter = response.headers?.['retry-after'] || response.headers?.['x-retry-after'] || null;
    console.error('[Gemini API Call Failed Log]', {
      attempt,
      statusCode: response.statusCode,
      errorType: errorInfo.code,
      message: errorInfo.message,
      retryAfterHeader: retryAfter,
      rawBody: response.body
    });

    const isTransient = errorInfo.code === 'RATE_LIMIT_RPM' || errorInfo.code === 'RATE_LIMIT_TPM';

    if (isTransient && attempt < maxRetries) {
      attempt++;
      // Exponential backoff: 2s, 4s, 8s plus random jitter (e.g. 0-1s)
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(`[Gemini Transient Limit] Retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})...`);
      await sleep(delay);
      continue;
    }

    return response;
  }
};

// ── Shared: handle Gemini response → validate → save quiz ─────────────────────
const handleGeminiResponse = async (geminiResponse, { title, durationMinutes, parsedFolderIds, createdBy }, res) => {
  const errorInfo = classifyGeminiError(geminiResponse.statusCode, geminiResponse.body);

  if (geminiResponse.statusCode !== 200) {
    return res.status(geminiResponse.statusCode === 429 ? 429 : 500).json({
      errorCode: errorInfo.code,
      message: errorInfo.message
    });
  }

  let geminiData;
  try { geminiData = JSON.parse(geminiResponse.body); } catch {
    return res.status(500).json({ errorCode: 'PARSE_ERROR', message: 'Could not parse AI response.' });
  }

  const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    return res.status(500).json({ errorCode: 'EMPTY_RESPONSE', message: 'AI returned an empty response. Please try again.' });
  }

  let extractedData;
  try {
    const cleaned = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    extractedData = JSON.parse(cleaned);
  } catch {
    return res.status(422).json({ errorCode: 'INVALID_JSON', message: 'AI response was not valid JSON. Please try again.', rawResponse: textContent.substring(0, 300) });
  }

  if (!extractedData.questions || !Array.isArray(extractedData.questions) || extractedData.questions.length === 0) {
    return res.status(422).json({ message: 'No questions could be extracted. Make sure your content contains multiple-choice questions.' });
  }

  const validQuestions = extractedData.questions.filter(q =>
    q.questionText && typeof q.questionText === 'string' && q.questionText.trim() &&
    Array.isArray(q.options) && q.options.length >= 2 &&
    q.options.every(o => typeof o === 'string' && o.trim())
  ).map(q => ({
    questionText: q.questionText.trim(),
    options: q.options.map(o => o.trim()),
    language: q.language || 'English',
    correctAnswer: ''
  }));

  if (validQuestions.length === 0) {
    return res.status(422).json({ message: 'All extracted questions failed validation. Check the content format.' });
  }

  const quiz = new Quiz({
    title: title.trim(),
    durationMinutes: parseInt(durationMinutes, 10),
    questions: validQuestions,
    isPublished: false,
    isDraft: true,
    folderIds: parsedFolderIds,
    createdBy
  });
  await quiz.save();

  return res.status(201).json({ quiz, extractedCount: validQuestions.length, warning: null });
};

// ── Shared extraction prompt ───────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are an expert quiz extractor. Extract ALL multiple-choice questions from the provided content.

STRICT RULES:
1. Return ONLY valid JSON — no markdown, no prose, no code blocks, no explanation.
2. Do NOT determine or guess the correct answer. Leave correct answers completely out.
3. Each question MUST have at least 2 options and at most 6 options.
4. Detect the language of each question (e.g. "English", "Hindi", "Gujarati") and include it in the language field.
5. Clean up any formatting artifacts. Skip incomplete questions.

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

// ── POST /api/generate/from-text — paste raw question text ────────────────────
router.post('/from-text', verifyAdmin, async (req, res) => {
  try {
    const { text, title, durationMinutes, folderIds } = req.body;

    if (!text || !text.trim() || text.trim().length < 20) {
      return res.status(400).json({ message: 'Please provide the question text.' });
    }
    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Quiz title and duration are required.' });
    }

    let parsedFolderIds = [];
    try { parsedFolderIds = folderIds ? (typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds) : []; } catch {}

    // Trim to ~60,000 chars to stay within token limits
    const trimmedText = text.length > 60000 ? text.slice(0, 60000) + '\n[...text continues...]' : text;

    const fullPrompt = `${EXTRACTION_PROMPT}\n\nHere is the question text:\n---\n${trimmedText}\n---`;

    let geminiResponse;
    try {
      geminiResponse = await callGeminiWithRetry([{ text: fullPrompt }]);
    } catch (err) {
      return res.status(503).json({ message: 'Failed to reach AI service. Please try again.' });
    }

    return handleGeminiResponse(geminiResponse, { title, durationMinutes, parsedFolderIds, createdBy: req.user.id }, res);

  } catch (err) {
    console.error('Generate from text error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── POST /api/generate/from-pdf — upload PDF file ─────────────────────────────
router.post('/from-pdf', verifyAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please upload a PDF file.' });

    const { title, durationMinutes, folderIds } = req.body;
    if (!title || !durationMinutes) return res.status(400).json({ message: 'Quiz title and duration are required.' });

    let parsedFolderIds = [];
    try { parsedFolderIds = folderIds ? (typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds) : []; } catch {}

    // Try text extraction first (cheap)
    let pdfText = '';
    let useBase64Fallback = false;
    try {
      const pdfData = await pdfParse(req.file.buffer, { max: 0 });
      pdfText = pdfData.text || '';
    } catch {
      useBase64Fallback = true;
    }
    if (!useBase64Fallback && pdfText.trim().length < 50) useBase64Fallback = true;

    let geminiResponse;
    try {
      if (useBase64Fallback) {
        // Scanned/image PDF → send as base64 for vision
        console.log('Using base64 vision mode for scanned PDF');
        const base64Pdf = req.file.buffer.toString('base64');
        geminiResponse = await callGeminiWithRetry([
          { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
          { text: EXTRACTION_PROMPT }
        ]);
      } else {
        // Text PDF → send extracted text only
        const trimmedText = pdfText.length > 60000 ? pdfText.slice(0, 60000) + '\n[...document continues...]' : pdfText;
        const fullPrompt = `${EXTRACTION_PROMPT}\n\nHere is the extracted PDF text:\n---\n${trimmedText}\n---`;
        geminiResponse = await callGeminiWithRetry([{ text: fullPrompt }]);
      }
    } catch (err) {
      return res.status(503).json({ message: 'Failed to reach AI service. Please try again.' });
    }

    return handleGeminiResponse(geminiResponse, { title, durationMinutes, parsedFolderIds, createdBy: req.user.id }, res);

  } catch (err) {
    if (err.message === 'Only PDF files are allowed.') return res.status(400).json({ message: 'Only PDF files are accepted.' });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'PDF is too large. Maximum size is 10MB.' });
    console.error('Generate from PDF error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
