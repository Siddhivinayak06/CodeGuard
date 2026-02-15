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
      const CHUNK_SIZE = 15000; // Characters per chunk
      const OVERLAP = 1000;
      const chunks = [];

      for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      logger.info(`Split PDF into ${chunks.length} chunks`);

      // 3. Process Chunks Concurrently
      const config = req.body.config ? JSON.parse(req.body.config) : {};

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
        const prompt = `
You are an expert curriculum designer. Extract ALL practical experiments from the text below as JSON.

INPUT TEXT:
This is chunk ${index + 1}.

OUTPUT JSON:
{
  "practicals": [
    {
      "practical_number": 1, 
      "title": "Title", 
      "description": "DETAILED problem statement. Include ALL constraints and requirements.",
      "max_marks": 10,
      "enableLevels": true, // ALWAYS SET TO TRUE. Every practical MUST have 2 tasks.
      "levels": [
        { 
          "level": "Task 1", 
          "title": "Task 1 Title", 
          "description": "Description for Task 1 (Standard Implementation of the concept)", 
          "max_marks": 5, 
          "reference_code": "...", 
          "testCases": [{ "input": "...", "expected_output": "..." }] 
        },
        { 
          "level": "Task 2", 
          "title": "Task 2 Title", 
          "description": "Description for Task 2 (ADVANCED/HARD version). Must include complex constraints, edge cases, or performance requirements.", 
          "max_marks": 5, 
          "reference_code": "...", 
          "testCases": [{ "input": "...", "expected_output": "..." }] 
        }
      ],
      "language": "c"
    }
  ]
}

RULES:
1. **EXTRACT ALL:** Do not skip any experiment found in the text.
2. **ALWAYS 2 TASKS:** 
   - **Task 1:** Standard, straightforward implementation of the core concept.
   - **Task 2:** **SIGNIFICANTLY HARDER**. It must involve complex logic, edge cases, input validation, or optimization. It should challenge the student.
3. **NUMBERING:** Use "Exp No" from text.
4. **JSON ONLY:** No markdown.
5. **REFERENCE CODE:** Generate COMPLETE, WORKING C solutions for BOTH tasks.
6. **TEST CASES:** Generate EXACTLY 2 test cases per Task.
7. 
8. TEXT:
9. ${chunkText}
10. `;

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
              }

              // 2. Fix common AI JSON errors
              // Escape unescaped newlines in strings
              cleaned = cleaned.replace(/\n/g, '\\n');

              // 3. Fix unescaped backslashes (very common in code)
              // This regex looks for backslashes that are NOT followed by valid escape chars
              // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
              // We want to escape invalid ones, e.g., \include -> \\include
              cleaned = cleaned.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');

              return JSON.parse(cleaned);
            } catch (_e) {
              return null;
            }
          };

          const parsed = repairJson(fullResponse);
          if (parsed && parsed.practicals) {
            return parsed.practicals;
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
        // Key by practical number if available, else title
        const key = p.practical_number
          ? `num-${p.practical_number}`
          : `title-${p.title?.trim()}`;

        if (!practicalsMap.has(key)) {
          practicalsMap.set(key, p);
        } else {
          // If exists, prefer the one with more information (e.g. levels or test cases)
          const existing = practicalsMap.get(key);
          if (
            (p.levels?.length || 0) > (existing.levels?.length || 0) ||
            (p.testCases?.length || 0) > (existing.testCases?.length || 0)
          ) {
            practicalsMap.set(key, p);
          }
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
      return res.status(400).json({ error: 'Code and error message are required' });
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
