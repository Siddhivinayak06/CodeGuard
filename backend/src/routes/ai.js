const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, codeContext, config } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await aiService.chat(messages, codeContext, config, (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    logger.error('AI Chat Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal AI Error' });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: err.message || 'Internal AI Error' })}\n\n`
      );
      res.end();
    }
  }
});

router.post('/chat2', async (req, res) => {
  try {
    const { messages, codeContext, config } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Inject the secondary API Key into config overrides
    // Inject the secondary API Key into config overrides ONLY if using Gemini
    const configOverrides = { ...config };
    if (!configOverrides.provider || configOverrides.provider === 'gemini') {
      configOverrides.apiKey = require('../config').ai.apiKey2;
    }

    await aiService.chat(messages, codeContext, configOverrides, (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    logger.error('AI Chat 2 Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal AI Error' });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: err.message || 'Internal AI Error' })}\n\n`
      );
      res.end();
    }
  }
});

// New endpoint for bulk generating practicals from PDF
router.post(
  '/generate-bulk-practicals-from-pdf',
  upload.single('pdf'),
  async (req, res) => {
    try {
      console.log('File upload:', {
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        hasBuffer: !!req.file?.buffer
      });
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      // 1. Extract text from PDF
      const pdfBuffer = req.file.buffer;
      let text = '';
      const parser = new PDFParse({ data: pdfBuffer });

      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }

      logger.info(`Extracted PDF text length: ${text.length}`);

      if (!text || text.trim().length === 0) {
        return res
          .status(400)
          .json({ error: 'Could not extract text from the PDF' });
      }

      // 2. Chunking Strategy
      const CHUNK_SIZE = 8000; // Characters per chunk (increased for better global context)
      const OVERLAP = 2000;
      const chunks = [];

      for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      logger.info(`Split PDF into ${chunks.length} chunks`);

      // 3. Process Chunks Concurrently
      const config = req.body.config ? JSON.parse(req.body.config) : {};
      const isExam = req.body.isExam === 'true' || req.body.isExam === true;

      // Inject secondary API Key for Gemini if needed for higher rate limits
      const configOverrides = { ...config };
      if (!configOverrides.provider || configOverrides.provider === 'gemini') {
        try {
          configOverrides.apiKey = require('../config').ai.apiKey2;
        } catch (_e) {
          // ignore if key2 missing
        }
      }

      const processChunk = async (chunkText, index) => {
        const itemType = isExam ? 'exam questions and sets' : 'practical experiments';
        const prompt = `
You are a precision PDF-to-Code mapping bot for a competitive programming platform.
Analyze the provided text and extract ALL coding problems/tasks into a valid JSON object.

OUTPUT JSON STRUCTURE (STRICT):
{
  "practicals": [
    {
      "practical_number": {Actual number (e.g. 1)}, 
      "title": "{Actual Set Name (e.g. Set A)}", 
      "description": "{General context for this set from PDF}",
      "max_marks": {Actual total marks for this set from PDF},
      "duration_minutes": {Actual time},
      "enableLevels": true,
      "language": "c",
      "levels": [
        { 
          "level": "Task 1", 
          "title": "{Actual Problem 1 Name}", 
          "description": "{Full statement...}\\n\\nSample Input: {input}\\nSample Output: {output}", 
          "max_marks": {Actual marks for this task},
          "reference_code": "MANDATORY: Complete solution code that reads from stdin and writes to stdout.", 
          "testCases": [{ "input": "{input}", "expected_output": "{output}" }] 
        }
      ],
      "sets": [
        { "set_name": "{Actual Set Name}", "level_names": ["{Actual Problem Name}"] }
      ]
    },
    {
      "practical_number": {Actual number (e.g. 2)}, 
      "title": "{Actual Set Name (e.g. Set B)}", 
      "max_marks": {Actual total marks for this set},
      "levels": [ { "level": "Task 1", "title": "{Problem name}", "max_marks": {marks}, "reference_code": "...", "testCases": [...] } ],
      "sets": [ { "set_name": "{Set Name}", "level_names": ["{Problem Name}"] } ]
    }
  ]
}

CRITICAL EXECUTION RULES:
1. **LITERAL MARKS & COUNTS:** You MUST extract the exact Marks and number of Sets exactly as they appear in the PDF. Do NOT use default values or perform your own calculations.
2. **DISTINCT SETS:** Every distinct "Set X" or "Task X" section in the PDF MUST be a separate entry in the 'practicals' array. Do NOT merge 8 sets into one.
3. **STRICT I/O CONSISTENCY:** The 'Sample Input' and 'Sample Output' in the description MUST exactly match the first 'testCase'.
4. **NO HALLUCINATIONS:** Use only actual data from the provided text.

TEXT:
${chunkText}
`;

        try {
          const messages = [{ role: 'user', parts: [{ text: prompt }] }];
          let fullResponse = '';
          await aiService.chat(messages, null, configOverrides, (chunk) => {
            fullResponse += chunk;
          });

          // Helper to attempt JSON repair
          const repairJson = (str) => {
            try {
              // 1. Extract from markdown if present
              let cleaned = str
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

              const first = cleaned.indexOf('{');
              const last = cleaned.lastIndexOf('}');
              if (first !== -1 && last !== -1) {
                cleaned = cleaned.substring(first, last + 1);
              }

              // Try parsing first
              try {
                return JSON.parse(cleaned);
              } catch (_e) {
                // Formatting failed, try fixing
                logger.debug(`JSON.parse failed, attempting repair...`);
              }

              // 2. Fix common AI JSON errors
              // Fix unescaped backslashes (very common in code)
              cleaned = cleaned.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
              
              try {
                return JSON.parse(cleaned);
              } catch (e2) {
                logger.debug(`Repair step 1 failed: ${e2.message}`);
                return null;
              }
            } catch (_e) {
              return null;
            }
          };

          logger.info(`Raw AI Response for chunk ${index}:\n${fullResponse}`);
          const parsed = repairJson(fullResponse);
          
          // Flexible extraction: find 'practicals' array wherever it is
          let practicals = [];
          if (Array.isArray(parsed)) {
            practicals = parsed;
          } else if (parsed && typeof parsed === 'object') {
            practicals = parsed.practicals || parsed.questions || parsed.exams || parsed.experiments || parsed.tasks || Object.values(parsed).find(v => Array.isArray(v)) || [];
          }
          
          if (practicals.length > 0) {
            return practicals;
          }

          logger.error(
            `Failed to parse AI response for chunk ${index}. Raw length: ${fullResponse.length}`
          );
          return [];
        } catch (e) {
          logger.error(`Error processing chunk ${index}:`, e);
          return [];
        }
      };

      // Limit concurrency (e.g., 5 parallel requests)
      const CONCURRENCY_LIMIT = 5;
      const results = [];

      for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
        const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.all(
          batch.map((chunk, batchIdx) => processChunk(chunk, i + batchIdx))
        );
        results.push(...batchResults.flat());
      }

      // 4. Merge and Deduplicate
      const practicalsMap = new Map();

      results.forEach((p) => {
        const key = p.practical_number
          ? `num-${p.practical_number}`
          : `title-${p.title?.trim().toLowerCase()}`;

        if (!practicalsMap.has(key)) {
          practicalsMap.set(key, { ...p });
        } else {
          const existing = practicalsMap.get(key);
          
          // Merge levels (deduplicate by level key to avoid partial chunk overlap duplicates)
          const levelMap = new Map();
          [...(existing.levels || []), ...(p.levels || [])].forEach(l => {
            const lKey = l.level || l.title;
            if (!levelMap.has(lKey) || (l.reference_code && !levelMap.get(lKey).reference_code)) {
              levelMap.set(lKey, l);
            }
          });
          existing.levels = Array.from(levelMap.values());

          // Merge testCases (for top-level practicals if they exist)
          if (p.testCases && p.testCases.length > 0) {
            existing.testCases = [...(existing.testCases || []), ...p.testCases];
          }

          // Merge sets
          if (p.sets && p.sets.length > 0) {
            const setMap = new Map();
            [...(existing.sets || []), ...(p.sets || [])].forEach(s => {
              const sKey = s.set_name;
              if (!setMap.has(sKey)) {
                setMap.set(sKey, s);
              } else {
                // Merge level_names for existing set
                const existingSet = setMap.get(sKey);
                existingSet.level_names = Array.from(new Set([...(existingSet.level_names || []), ...(s.level_names || [])]));
              }
            });
            existing.sets = Array.from(setMap.values());
          }

          // Update other fields if they were missing
          if (!existing.description && p.description) existing.description = p.description;
          if (!existing.language && p.language) existing.language = p.language;
          if (!existing.max_marks && p.max_marks) existing.max_marks = p.max_marks;
        }
      });

      const practicals = Array.from(practicalsMap.values()).sort(
        (a, b) => a.practical_number - b.practical_number
      );

      return res.json({ practicals });
    } catch (err) {
      logger.error('Bulk Generation Error:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
);

router.post('/explain-error', async (req, res) => {
  try {
    const { code, error, language, config } = req.body;

    if (!code || !error) {
      return res
        .status(400)
        .json({ error: 'Code and error message are required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const prompt = `
I encountered this error in my ${language || 'code'}:

CODE:
\`\`\`${language || ''}
${code}
\`\`\`

ERROR:
${error}

Please explain:
1. What this error means in simple terms (for a beginner).
2. Exactly which line/part of the code is likely causing it.
3. How to fix it (provide the corrected code snippet).
`;

    const messages = [{ role: 'user', parts: [{ text: prompt }] }];

    // Prepare config overrides (inject secondary key if using Gemini, similar to other endpoints)
    const configOverrides = { ...config };
    if (!configOverrides.provider || configOverrides.provider === 'gemini') {
      try {
        configOverrides.apiKey = require('../config').ai.apiKey2;
      } catch (_e) {
        // ignore if key2 missing
      }
    }

    await aiService.chat(messages, null, configOverrides, (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    logger.error('Explain Error Failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal AI Error' });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: err.message || 'Internal AI Error' })}\n\n`
      );
      res.end();
    }
  }
});

module.exports = router;
