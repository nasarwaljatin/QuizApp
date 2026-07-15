const express = require('express');
const router = express.Router();
const multer = require('multer');
const https = require('https');
const Quiz = require('../models/Quiz');
const verifyAdmin = require('../middleware/verifyAdmin');
const { pdfToImg } = require('pdftoimg-js');

// Multer: memory storage, PDF only, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  }
});

// Helper: classify NVIDIA API errors based on status code and response body
const classifyNvidiaError = (statusCode, body) => {
  if (statusCode === 403 || statusCode === 401) {
    return { code: 'INVALID_KEY', message: 'NVIDIA API key is invalid or not authorized.' };
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

// ── Shared NVIDIA NIM caller ───────────────────────────────────────────────────────
const callNvidiaNIM = (model, messages, maxTokens = 2048) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return reject(new Error('NVIDIA_API_KEY is not set on the server.'));

    const requestBody = JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      ...(model.includes('instruct') ? { response_format: { type: "json_object" } } : {})
    });

    const options = {
      hostname: 'integrate.api.nvidia.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
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

// Helper: call NVIDIA NIM with automatic retry for transient limits (RPM/TPM)
const callNvidiaNIMWithRetry = async (model, messages, maxTokens = 2048) => {
  let attempt = 0;
  const maxRetries = 3;

  while (true) {
    let response;
    try {
      response = await callNvidiaNIM(model, messages, maxTokens);
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`[NVIDIA NIM Request Failure] Network error, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries}):`, err.message);
        await sleep(delay);
        continue;
      }
      throw err;
    }

    if (response.statusCode === 200) {
      return response;
    }

    const errorInfo = classifyNvidiaError(response.statusCode, response.body);

    const retryAfter = response.headers?.['retry-after'] || response.headers?.['x-retry-after'] || null;
    console.error('[NVIDIA API Call Failed Log]', {
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
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(`[NVIDIA Transient Limit] Retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})...`);
      await sleep(delay);
      continue;
    }

    return response;
  }
};

// ── Shared: handle extracted text → validate → save quiz ─────────────────────
const handleExtractedQuestions = async (textContent, { title, durationMinutes, parsedFolderIds, createdBy }, res) => {
  let extractedData;
  try {
    const cleaned = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    extractedData = JSON.parse(cleaned);
  } catch {
    return res.status(422).json({ errorCode: 'INVALID_JSON', message: 'AI response was not valid JSON. Please try again.', rawResponse: textContent.substring(0, 300) });
  }

  if (!extractedData.questions || !Array.isArray(extractedData.questions) || extractedData.questions.length === 0) {
    return res.status(422).json({ message: 'No questions could be extracted. Please make sure the content contains valid questions.' });
  }

  const validQuestions = extractedData.questions
    .map(validateAndFormatQuestion)
    .filter(q => q !== null);

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

// Helper to validate and format each extracted question dynamically based on its classified type
const validateAndFormatQuestion = (q) => {
  if (!q || !q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) {
    return null;
  }

  // Normalize question type
  let type = q.questionType;
  if (!type || typeof type !== 'string') {
    type = 'mcq';
  }
  type = type.toLowerCase().trim();
  if (type !== 'mcq' && type !== 'integer' && type !== 'text') {
    type = 'mcq';
  }

  // Options normalization
  let options = [];
  if (type === 'mcq') {
    if (Array.isArray(q.options) && q.options.length >= 2 && q.options.every(o => typeof o === 'string' && o.trim())) {
      options = q.options.map(o => o.trim());
    } else {
      // Fallback options for low confidence MCQ missing options due to poor OCR
      options = Array.isArray(q.options) && q.options.length > 0
        ? q.options.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim())
        : [];
      if (options.length < 2) {
        options = ['Option A', 'Option B'];
      }
    }
  }

  return {
    questionText: q.questionText.trim(),
    questionType: type,
    options: options,
    imageUrl: '',
    suggestedAnswer: q.suggestedAnswer ? String(q.suggestedAnswer).trim() : '',
    language: q.language || 'English',
    correctAnswer: '',
    correctAnswers: []
  };
};

// ── Shared extraction prompt ───────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are an expert quiz extractor. Extract ALL questions from the provided content.

STRICT RULES:
1. Return ONLY valid JSON — no markdown, no prose, no code blocks, no explanation.
2. Classify each question's type:
   - "mcq": Multiple-choice question with options. Populated "options" array is required.
   - "integer": A numeric answer question with no options (e.g. "Find the value of...", "Calculate the resistance...", "What is the sum..."). Do NOT provide "options".
   - "text": A short text/word/phrase answer with no options and no numeric expectation (e.g. fill-in-the-blank or naming questions). Do NOT provide "options".
3. If you cannot determine the type or if options are ambiguous, default to "mcq" with options.
4. Do NOT determine or guess the correct answer for grading. However, if the source content includes a separate answer key section (like answers listed at the end of the document), extract the answer value for each question and save it ONLY in the "suggestedAnswer" field. Never set correct answers in other fields. If no answer key is present, leave "suggestedAnswer" empty ("").
5. Detect the language of each question (e.g. "English", "Hindi", "Gujarati") and include it in the "language" field.
6. Clean up any formatting artifacts. Skip incomplete questions.

Return this EXACT JSON structure:
{
  "questions": [
    {
      "questionText": "full question text here",
      "questionType": "mcq", // "mcq" | "integer" | "text"
      "options": ["option A text", "option B text", "option C text", "option D text"], // only include if questionType is "mcq"
      "suggestedAnswer": "answer value from key if present, otherwise empty string",
      "language": "English"
    }
  ]
}`;

// ── POST /api/generate/from-text — paste raw question text ────────────────────
router.post('/from-text', verifyAdmin, async (req, res) => {
  try {
    if (!process.env.NVIDIA_API_KEY) {
      return res.status(401).json({
        errorCode: 'INVALID_KEY',
        message: 'NVIDIA_API_KEY is not set on the server. Please add it to your environment variables.'
      });
    }

    const { text, title, durationMinutes, folderIds } = req.body;

    if (!text || !text.trim() || text.trim().length < 20) {
      return res.status(400).json({ message: 'Please provide the question text.' });
    }
    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Quiz title and duration are required.' });
    }

    let parsedFolderIds = [];
    try { parsedFolderIds = folderIds ? (typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds) : []; } catch {}

    const trimmedText = text.length > 60000 ? text.slice(0, 60000) + '\n[...text continues...]' : text;

    const chatMessages = [
      {
        role: "system",
        content: "You are an expert system that extracts questions (MCQ, integer-type, and text-type) from raw text and formats them as strict JSON."
      },
      {
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\nHere is the question text:\n---\n${trimmedText}\n---`
      }
    ];

    const nimResponse = await callNvidiaNIMWithRetry('meta/llama-3.1-70b-instruct', chatMessages, 2048);

    if (nimResponse.statusCode !== 200) {
      const errorInfo = classifyNvidiaError(nimResponse.statusCode, nimResponse.body);
      return res.status(nimResponse.statusCode === 429 ? 429 : 500).json({
        errorCode: errorInfo.code,
        message: errorInfo.message
      });
    }

    const textContent = JSON.parse(nimResponse.body)?.choices?.[0]?.message?.content;
    if (!textContent) {
      return res.status(500).json({ errorCode: 'EMPTY_RESPONSE', message: 'AI returned an empty response. Please try again.' });
    }

    return handleExtractedQuestions(textContent, { title, durationMinutes, parsedFolderIds, createdBy: req.user.id }, res);

  } catch (err) {
    console.error('Generate from text error:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── POST /api/generate/from-pdf — upload PDF file ─────────────────────────────
router.post('/from-pdf', verifyAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!process.env.NVIDIA_API_KEY) {
      return res.status(401).json({
        errorCode: 'INVALID_KEY',
        message: 'NVIDIA_API_KEY is not set on the server. Please check the environment variables.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file.' });
    }

    const { title, durationMinutes, folderIds } = req.body;
    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Quiz title and duration are required.' });
    }

    let parsedFolderIds = [];
    try { parsedFolderIds = folderIds ? (typeof folderIds === 'string' ? JSON.parse(folderIds) : folderIds) : []; } catch {}

    // Establish SSE connection headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendProgress = (message) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', message })}\n\n`);
    };

    const sendError = (statusCode, errorCode, message) => {
      res.write(`data: ${JSON.stringify({ type: 'error', statusCode, errorCode, message })}\n\n`);
      res.end();
    };

    sendProgress('Converting PDF to images...');

    let pageImages = [];
    try {
      const rawImages = await pdfToImg(req.file.buffer, {
        scale: 1.5,
        imgType: 'png'
      });
      pageImages = Array.isArray(rawImages) ? rawImages : [rawImages];
    } catch (err) {
      console.error('PDF-to-images conversion error:', err);
      return sendError(500, 'CONVERSION_ERROR', 'Failed to convert PDF to images: ' + err.message);
    }

    if (pageImages.length === 0) {
      return sendError(400, 'EMPTY_PDF', 'The PDF contains no pages.');
    }

    sendProgress(`PDF converted successfully. Found ${pageImages.length} page(s). Starting extraction...`);

    const allQuestions = [];
    const failedPages = [];

    for (let i = 0; i < pageImages.length; i++) {
      sendProgress(`Processing page ${i + 1} of ${pageImages.length}...`);

      try {
        const dataUrl = pageImages[i];
        const base64Data = dataUrl.split(',')[1] || dataUrl;

        // Step A: Call NVIDIA Nemotron OCR to extract text from the page image
        const ocrMessages = [
          {
            role: "user",
            content: `Perform OCR on this image. Return only the raw text, preserving the content of questions and options. <img src="data:image/png;base64,${base64Data}" />`
          }
        ];

        const ocrResponse = await callNvidiaNIMWithRetry('nvidia/nemotron-ocr-v2', ocrMessages, 4096);

        if (ocrResponse.statusCode !== 200) {
          const errorInfo = classifyNvidiaError(ocrResponse.statusCode, ocrResponse.body);
          console.warn(`[Page ${i + 1}] OCR model failed:`, errorInfo.message);

          if (errorInfo.code === 'INVALID_KEY') {
            return sendError(401, 'INVALID_KEY', 'NVIDIA API key is invalid or unauthorized. Please verify the NVIDIA_API_KEY on the server.');
          }
          if (errorInfo.code === 'RATE_LIMIT_RPD') {
            return sendError(429, 'RATE_LIMIT_RPD', 'Daily quota for NVIDIA NIM has been reached. Please check build.nvidia.com.');
          }

          failedPages.push(i + 1);
          continue;
        }

        const ocrResult = JSON.parse(ocrResponse.body);
        const pageText = ocrResult?.choices?.[0]?.message?.content;

        if (!pageText || pageText.trim().length < 10) {
          console.warn(`[Page ${i + 1}] OCR returned empty or very short text.`);
          failedPages.push(i + 1);
          continue;
        }

        // Step B: Call instruction-following chat completion to structure questions into JSON
        const chatMessages = [
          {
            role: "system",
            content: "You are an expert system that extracts questions (MCQ, integer-type, and text-type) from raw OCR text and formats them as strict JSON."
          },
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\nHere is the raw OCR text from page ${i + 1}:\n---\n${pageText}\n---`
          }
        ];

        const chatResponse = await callNvidiaNIMWithRetry('meta/llama-3.1-70b-instruct', chatMessages, 2048);

        if (chatResponse.statusCode !== 200) {
          const errorInfo = classifyNvidiaError(chatResponse.statusCode, chatResponse.body);
          console.warn(`[Page ${i + 1}] Structuring model failed:`, errorInfo.message);

          if (errorInfo.code === 'INVALID_KEY') {
            return sendError(401, 'INVALID_KEY', 'NVIDIA API key is invalid or unauthorized. Please verify the NVIDIA_API_KEY on the server.');
          }
          if (errorInfo.code === 'RATE_LIMIT_RPD') {
            return sendError(429, 'RATE_LIMIT_RPD', 'Daily quota for NVIDIA NIM has been reached. Please check build.nvidia.com.');
          }

          failedPages.push(i + 1);
          continue;
        }

        const chatResult = JSON.parse(chatResponse.body);
        const contentText = chatResult?.choices?.[0]?.message?.content;

        if (!contentText) {
          console.warn(`[Page ${i + 1}] Chat model returned empty response.`);
          failedPages.push(i + 1);
          continue;
        }

        // Parse structured questions
        let extractedData;
        try {
          const cleaned = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          extractedData = JSON.parse(cleaned);
        } catch {
          console.warn(`[Page ${i + 1}] Failed to parse chat model response as JSON:`, contentText.substring(0, 200));
          failedPages.push(i + 1);
          continue;
        }

        if (extractedData?.questions && Array.isArray(extractedData.questions)) {
          extractedData.questions.forEach(q => {
            const formatted = validateAndFormatQuestion(q);
            if (formatted) {
              allQuestions.push(formatted);
            }
          });
        }
      } catch (pageErr) {
        console.error(`[Page ${i + 1}] Unhandled extraction error:`, pageErr);
        failedPages.push(i + 1);
      }
    }

    if (allQuestions.length === 0) {
      let failMsg = 'No questions could be extracted from the PDF.';
      if (failedPages.length > 0) {
        failMsg += ` (Failed on pages: ${failedPages.join(', ')})`;
      }
      return sendError(422, 'EXTRACTION_FAILED', failMsg);
    }

    const quiz = new Quiz({
      title: title.trim(),
      durationMinutes: parseInt(durationMinutes, 10),
      questions: allQuestions,
      isPublished: false,
      isDraft: true,
      folderIds: parsedFolderIds,
      createdBy: req.user.id
    });
    await quiz.save();

    let warningMsg = null;
    if (failedPages.length > 0) {
      warningMsg = `Quiz generated, but some pages failed to extract questions: ${failedPages.join(', ')}`;
    }

    res.write(`data: ${JSON.stringify({ type: 'success', quiz, extractedCount: allQuestions.length, warning: warningMsg })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Generate from PDF error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error.', error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', statusCode: 500, errorCode: 'SERVER_ERROR', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// ── POST /api/generate/add-to-quiz/:quizId — add AI questions to existing quiz ──
router.post('/add-to-quiz/:quizId', verifyAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    if (!process.env.NVIDIA_API_KEY) {
      return res.status(401).json({
        errorCode: 'INVALID_KEY',
        message: 'NVIDIA_API_KEY is not set on the server.'
      });
    }

    // PDF Mode
    if (req.file) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const sendProgress = (message) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', message })}\n\n`);
      };

      const sendError = (statusCode, errorCode, message) => {
        res.write(`data: ${JSON.stringify({ type: 'error', statusCode, errorCode, message })}\n\n`);
        res.end();
      };

      sendProgress('Converting PDF to images...');

      let pageImages = [];
      try {
        const rawImages = await pdfToImg(req.file.buffer, { scale: 1.5, imgType: 'png' });
        pageImages = Array.isArray(rawImages) ? rawImages : [rawImages];
      } catch (err) {
        console.error('PDF-to-images conversion error:', err);
        return sendError(500, 'CONVERSION_ERROR', 'Failed to convert PDF to images: ' + err.message);
      }

      if (pageImages.length === 0) {
        return sendError(400, 'EMPTY_PDF', 'The PDF contains no pages.');
      }

      sendProgress(`PDF converted. Found ${pageImages.length} page(s). Starting extraction...`);

      const allQuestions = [];
      const failedPages = [];

      for (let i = 0; i < pageImages.length; i++) {
        sendProgress(`Processing page ${i + 1} of ${pageImages.length}...`);

        try {
          const dataUrl = pageImages[i];
          const base64Data = dataUrl.split(',')[1] || dataUrl;

          // Step A: Call NVIDIA Nemotron OCR
          const ocrMessages = [
            {
              role: "user",
              content: `Perform OCR on this image. Return only the raw text, preserving the content of questions and options. <img src="data:image/png;base64,${base64Data}" />`
            }
          ];

          const ocrResponse = await callNvidiaNIMWithRetry('nvidia/nemotron-ocr-v2', ocrMessages, 4096);

          if (ocrResponse.statusCode !== 200) {
            const errorInfo = classifyNvidiaError(ocrResponse.statusCode, ocrResponse.body);
            if (errorInfo.code === 'INVALID_KEY') {
              return sendError(401, 'INVALID_KEY', 'NVIDIA API key is invalid or unauthorized.');
            }
            if (errorInfo.code === 'RATE_LIMIT_RPD') {
              return sendError(429, 'RATE_LIMIT_RPD', 'Daily quota for NVIDIA NIM reached.');
            }
            failedPages.push(i + 1);
            continue;
          }

          const ocrResult = JSON.parse(ocrResponse.body);
          const pageText = ocrResult?.choices?.[0]?.message?.content;

          if (!pageText || pageText.trim().length < 10) {
            failedPages.push(i + 1);
            continue;
          }

          // Step B: Call Llama 3.1 Instruct to structure questions
          const chatMessages = [
            {
              role: "system",
              content: "You are an expert system that extracts multiple-choice questions from raw OCR text and formats them as strict JSON."
            },
            {
              role: "user",
              content: `${EXTRACTION_PROMPT}\n\nHere is the raw OCR text from page ${i + 1}:\n---\n${pageText}\n---`
            }
          ];

          const chatResponse = await callNvidiaNIMWithRetry('meta/llama-3.1-70b-instruct', chatMessages, 2048);

          if (chatResponse.statusCode !== 200) {
            const errorInfo = classifyNvidiaError(chatResponse.statusCode, chatResponse.body);
            if (errorInfo.code === 'INVALID_KEY') {
              return sendError(401, 'INVALID_KEY', 'NVIDIA API key is invalid or unauthorized.');
            }
            if (errorInfo.code === 'RATE_LIMIT_RPD') {
              return sendError(429, 'RATE_LIMIT_RPD', 'Daily quota for NVIDIA NIM reached.');
            }
            failedPages.push(i + 1);
            continue;
          }

          const chatResult = JSON.parse(chatResponse.body);
          const contentText = chatResult?.choices?.[0]?.message?.content;

          if (!contentText) {
            failedPages.push(i + 1);
            continue;
          }

          let extractedData;
          try {
            const cleaned = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            extractedData = JSON.parse(cleaned);
          } catch {
            failedPages.push(i + 1);
            continue;
          }

          if (extractedData?.questions && Array.isArray(extractedData.questions)) {
            extractedData.questions.forEach(q => {
              const formatted = validateAndFormatQuestion(q);
              if (formatted) {
                allQuestions.push(formatted);
              }
            });
          }
        } catch (pageErr) {
          console.error(`[Page ${i + 1}] Add questions extraction error:`, pageErr);
          failedPages.push(i + 1);
        }
      }

      if (allQuestions.length === 0) {
        let failMsg = 'No questions could be extracted from the PDF.';
        if (failedPages.length > 0) {
          failMsg += ` (Failed on pages: ${failedPages.join(', ')})`;
        }
        return sendError(422, 'EXTRACTION_FAILED', failMsg);
      }

      quiz.questions.push(...allQuestions);
      quiz.isPublished = false;
      quiz.isDraft = true;
      await quiz.save();

      let warningMsg = null;
      if (failedPages.length > 0) {
        warningMsg = `Questions added, but some pages failed: ${failedPages.join(', ')}`;
      }

      res.write(`data: ${JSON.stringify({ type: 'success', quiz, extractedCount: allQuestions.length, warning: warningMsg })}\n\n`);
      res.end();

    } else {
      // Text Mode
      const { text } = req.body;
      if (!text || !text.trim() || text.trim().length < 20) {
        return res.status(400).json({ message: 'Please provide the question text.' });
      }

      const trimmedText = text.length > 60000 ? text.slice(0, 60000) + '\n[...text continues...]' : text;

      const chatMessages = [
        {
          role: "system",
          content: "You are an expert system that extracts questions (MCQ, integer-type, and text-type) from raw text and formats them as strict JSON."
        },
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\nHere is the question text:\n---\n${trimmedText}\n---`
        }
      ];

      const nimResponse = await callNvidiaNIMWithRetry('meta/llama-3.1-70b-instruct', chatMessages, 2048);

      if (nimResponse.statusCode !== 200) {
        const errorInfo = classifyNvidiaError(nimResponse.statusCode, nimResponse.body);
        return res.status(nimResponse.statusCode === 429 ? 429 : 500).json({
          errorCode: errorInfo.code,
          message: errorInfo.message
        });
      }

      const textContent = JSON.parse(nimResponse.body)?.choices?.[0]?.message?.content;
      if (!textContent) {
        return res.status(500).json({ errorCode: 'EMPTY_RESPONSE', message: 'AI returned empty response.' });
      }

      let extractedData;
      try {
        const cleaned = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        extractedData = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({ errorCode: 'INVALID_JSON', message: 'AI response was not valid JSON.' });
      }

      if (!extractedData.questions || !Array.isArray(extractedData.questions) || extractedData.questions.length === 0) {
        return res.status(422).json({ message: 'No questions could be extracted.' });
      }

      const validQuestions = extractedData.questions
        .map(validateAndFormatQuestion)
        .filter(q => q !== null);

      if (validQuestions.length === 0) {
        return res.status(422).json({ message: 'All extracted questions failed validation.' });
      }

      quiz.questions.push(...validQuestions);
      quiz.isPublished = false;
      quiz.isDraft = true;
      await quiz.save();

      return res.status(201).json({ quiz, extractedCount: validQuestions.length, warning: null });
    }
  } catch (err) {
    console.error('Add questions error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error.', error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', statusCode: 500, errorCode: 'SERVER_ERROR', message: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
