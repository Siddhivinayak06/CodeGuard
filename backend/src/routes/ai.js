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
        hasBuffer: !!req.file?.buffer,
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
        const itemType = isExam
          ? 'exam questions and sets'
          : 'practical experiments';

        // Use a different prompt for exams vs practicals
        const prompt = isExam
          ? `
You are a precision PDF-to-Code mapping bot for a competitive programming / exam platform.
Analyze the provided exam paper text. The paper typically has multiple SETS (e.g. "Set A", "Set B", etc.), each containing numbered questions with marks.

Your job: Extract ALL questions from ALL sets into a SINGLE JSON object.

OUTPUT JSON STRUCTURE (STRICT - return ONLY this JSON, no markdown, no explanation):
{
  "practicals": [
    {
      "practical_number": 1,
      "title": "Exam",
      "description": "",
      "max_marks": {Total marks of the largest set},
      "duration_minutes": null,
      "enableLevels": true,
      "language": "c",
      "levels": [
        {
          "level": "{SetName} - Q{number}",
          "title": "{Unique descriptive title derived from the problem statement}",
          "description": "{FULL problem statement copied verbatim from PDF, including all examples, constraints, and sub-parts}\\n\\nSample Input: {Same as first testCase input}\\nSample Output: {Same as first testCase output}",
          "max_marks": {Exact marks from PDF},
          "reference_code": "COMPLETE WORKING SOLUTION in C. MUST read from stdin and write to stdout. NO HARDCODED INPUT VALUES.",
          "starter_code": "Incomplete template with function signature and TODO comments for student to fill in",
          "testCases": [{"input": "{sample input}", "expected_output": "{sample output}"}]
        }
      ],
      "sets": [
        {
          "set_name": "Set A",
          "level_names": ["{EXACT same title strings as used in levels[].title for this set's questions}"]
        },
        {
          "set_name": "Set B",
          "level_names": ["{EXACT same title strings as used in levels[].title for this set's questions}"]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. **ALL levels go in ONE practicals entry.** Do NOT create separate practicals for each set.
2. **Globally unique titles:** Each level MUST have a unique "title". If two questions in different sets are similar, make titles distinct (e.g. "Card Game Probability (Set A)" vs "Browser History Navigation (Set B)").
3. **level field format:** Use "{SetName} - Q{number}" format (e.g. "Set A - Q1", "Set B - Q2") to keep them globally unique.
4. **sets[].level_names MUST exactly match levels[].title:** The strings in level_names must be character-for-character identical to the corresponding level's "title" field. This is critical for the frontend mapping.
5. **LITERAL MARKS:** Extract exact marks as they appear in the PDF.
6. **Sub-parts:** If a question has sub-parts (a), (b), (c) with separate marks, combine them into ONE level. Include all sub-parts in the description. Sum their marks for max_marks.
7. **Sample I/O in Description:** Every level's 'description' MUST include at least one 'Sample Input' and 'Sample Output' pair. These MUST be character-for-character identical to the first entry in 'testCases'.
8. **NO HALLUCINATIONS:** Use only actual data from the provided text.
9. **reference_code:** Must be complete, compilable C code. It MUST read input from stdin (e.g., 'scanf') and print to stdout ('printf'). NEVER initialize variables with sample input data inside the code.
10. **starter_code:** Must be an incomplete template with the function signature and TODO placeholders.
11. **I/O CONSISTENCY:** The 'expected_output' in 'testCases' MUST be the exact literal result of running the 'input' through the 'reference_code'.

TEXT:
${chunkText}
`
          : `
You are a precision PDF-to-Code mapping bot for a competitive programming platform.
Analyze the provided text and extract ALL coding problems/tasks into a valid JSON object.

OUTPUT JSON STRUCTURE (STRICT):
{
  "practicals": [
    {
      "practical_number": {Actual number (e.g. 1)}, 
      "title": "{Actual Problem Title}", 
      "description": "{Full problem statement...}\\n\\nSample Input: {input}\\nSample Output: {output}", 
      "max_marks": {Actual marks},
      "enableLevels": false,
      "language": "c",
      "reference_code": "MANDATORY: Complete solution code. MUST read from stdin and write to stdout. NO HARDCODED INPUT.",
      "starter_code": "Incomplete template with function signature and TODO comments.",
      "testCases": [{ "input": "{input}", "expected_output": "{output}" }]
    }
  ]
}

CRITICAL EXECUTION RULES:
1. **LITERAL MARKS & COUNTS:** Extract exact Marks as they appear in the PDF.
2. **DISTINCT PROBLEMS:** Every distinct problem/experiment MUST be a separate entry.
3. **STRICT I/O CONSISTENCY:** Every problem 'description' MUST include a 'Sample Input' and 'Sample Output' pair that exactly matches the FIRST 'testCase' entry.
4. **NO HALLUCINATIONS:** Use only actual data from the provided text.
5. **reference_code:** Must be complete, compilable C code. It MUST read from stdin and print to stdout. NO HARDCODED INPUT.
6. **starter_code:** Must be an incomplete template with TODO placeholders.
7. **I/O CONSISTENCY:** The 'expected_output' MUST match the result of running the 'input' through 'reference_code'.

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
            practicals =
              parsed.practicals ||
              parsed.questions ||
              parsed.exams ||
              parsed.experiments ||
              parsed.tasks ||
              Object.values(parsed).find((v) => Array.isArray(v)) ||
              [];
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
          [...(existing.levels || []), ...(p.levels || [])].forEach((l) => {
            const lKey = l.level || l.title;
            if (
              !levelMap.has(lKey) ||
              (l.reference_code && !levelMap.get(lKey).reference_code)
            ) {
              levelMap.set(lKey, l);
            }
          });
          existing.levels = Array.from(levelMap.values());

          // Merge testCases (for top-level practicals if they exist)
          if (p.testCases && p.testCases.length > 0) {
            existing.testCases = [
              ...(existing.testCases || []),
              ...p.testCases,
            ];
          }

          // Merge sets
          if (p.sets && p.sets.length > 0) {
            const setMap = new Map();
            [...(existing.sets || []), ...(p.sets || [])].forEach((s) => {
              const sKey = s.set_name;
              if (!setMap.has(sKey)) {
                setMap.set(sKey, s);
              } else {
                // Merge level_names for existing set
                const existingSet = setMap.get(sKey);
                existingSet.level_names = Array.from(
                  new Set([
                    ...(existingSet.level_names || []),
                    ...(s.level_names || []),
                  ])
                );
              }
            });
            existing.sets = Array.from(setMap.values());
          }

          // Update other fields if they were missing
          if (!existing.description && p.description)
            existing.description = p.description;
          if (!existing.language && p.language) existing.language = p.language;
          if (!existing.max_marks && p.max_marks)
            existing.max_marks = p.max_marks;
        }
      });

      let practicals = Array.from(practicalsMap.values()).sort(
        (a, b) => a.practical_number - b.practical_number
      );

      // 5. Post-processing for exams: ensure level titles are unique and sets map correctly
      if (isExam) {
        practicals = practicals.map((p) => {
          if (!p.levels || p.levels.length === 0) return p;

          // Step A: Ensure all level titles are globally unique
          const titleCounts = new Map();
          p.levels.forEach((l) => {
            const t = (l.title || l.level || '').trim();
            titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
          });

          // For duplicate titles, append the level key to make them unique
          const titleSeen = new Map();
          p.levels = p.levels.map((l) => {
            const t = (l.title || l.level || '').trim();
            if (titleCounts.get(t) > 1) {
              const count = (titleSeen.get(t) || 0) + 1;
              titleSeen.set(t, count);
              // Use the level key (e.g. "Set A - Q1") as part of the title
              const levelPrefix = l.level || `Variant ${count}`;
              l.title = `${t} (${levelPrefix})`;
            }
            return l;
          });

          // Step B: Build a map from level key -> title for set mapping
          const levelKeyToTitle = new Map();
          p.levels.forEach((l) => {
            if (l.level) levelKeyToTitle.set(l.level, l.title || l.level);
          });

          // Step C: Re-derive sets[].level_names to match actual level titles
          if (p.sets && p.sets.length > 0) {
            const setPrefix = (setName) => {
              // Extract set identifier (e.g. "Set A" -> "Set A")
              return (setName || '').trim();
            };

            p.sets = p.sets.map((s) => {
              const sName = setPrefix(s.set_name);

              // Strategy 1: Try to keep existing level_names if they match actual titles
              const allTitles = new Set(p.levels.map((l) => l.title));
              const validNames = (s.level_names || []).filter((n) =>
                allTitles.has(n)
              );

              if (validNames.length > 0) {
                s.level_names = validNames;
              } else {
                // Strategy 2: Match levels whose level key starts with the set name
                const matchedTitles = p.levels
                  .filter((l) => {
                    const lKey = (l.level || '').toLowerCase();
                    return lKey.startsWith(sName.toLowerCase());
                  })
                  .map((l) => l.title || l.level);

                if (matchedTitles.length > 0) {
                  s.level_names = matchedTitles;
                }
                // else keep original level_names as fallback
              }

              return s;
            });
          } else {
            // No sets provided by AI - create them from level keys
            // Group levels by their set prefix (e.g. "Set A - Q1" -> "Set A")
            const setGroups = new Map();
            p.levels.forEach((l) => {
              const lKey = l.level || '';
              const dashIdx = lKey.indexOf(' - ');
              const groupName =
                dashIdx > 0 ? lKey.substring(0, dashIdx).trim() : 'Default Set';
              if (!setGroups.has(groupName)) setGroups.set(groupName, []);
              setGroups.get(groupName).push(l.title || l.level);
            });

            if (setGroups.size > 0) {
              p.sets = Array.from(setGroups.entries()).map(
                ([name, titles]) => ({
                  set_name: name,
                  level_names: titles,
                })
              );
            }
          }

          logger.info(
            `[PostProcess] Practical "${p.title}": ${p.levels.length} levels, ${(p.sets || []).length} sets`
          );
          (p.sets || []).forEach((s) => {
            logger.info(
              `  Set "${s.set_name}": level_names=[${s.level_names.join(', ')}]`
            );
          });

          return p;
        });
      }

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
