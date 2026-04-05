const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const { z } = require('zod');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  generateFuzzTestCases,
} = require('../services/testCaseGeneratorService');

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

router.post(
  '/generate-fuzz-testcases',
  requireRole(['admin', 'faculty']),
  async (req, res) => {
    try {
      const result = await generateFuzzTestCases(req.body || {});
      return res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          details: err.errors,
        });
      }

      logger.error('Fuzzer test case generation failed', {
        error: err.message,
      });
      return res.status(500).json({
        error: err.message || 'Failed to generate fuzz test cases',
      });
    }
  }
);

// New endpoint for bulk generating practicals from PDF
router.post(
  '/generate-bulk-practicals-from-pdf',
  requireRole(['admin', 'faculty']),
  upload.single('pdf'),
  async (req, res) => {
    try {
      logger.info('File upload:', {
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
      const CHUNK_SIZE = 8000;
      const OVERLAP = 2000;
      const chunks = [];

      for (let i = 0; i < text.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
      }

      logger.info(`Split PDF into ${chunks.length} chunks`);

      // 3. Process Chunks Concurrently
      const config = req.body.config ? JSON.parse(req.body.config) : {};
      const isExam = req.body.isExam === 'true' || req.body.isExam === true;
      const language = (req.body.language || 'c').toLowerCase();

      const configOverrides = { ...config };
      if (!configOverrides.provider || configOverrides.provider === 'gemini') {
        try {
          configOverrides.apiKey = require('../config').ai.apiKey2;
        } catch (_e) {
          // ignore if key2 missing
        }
      }

      // ─── SHARED MARKDOWN DESCRIPTION TEMPLATE (injected into both prompts) ───
      //
      // Each "description" field MUST follow this EXACT Markdown structure:
      //
      // ## Problem Statement
      // <Full verbatim problem statement from the PDF>
      //
      // ## Objective
      // <One-line goal: what the student must implement>
      //
      // ## Input Format
      // - <Line-by-line description of each input>
      //
      // ## Output Format
      // - <Line-by-line description of expected output>
      //
      // ## Constraints
      // - <Each constraint as a bullet, e.g. 1 ≤ N ≤ 1000>
      //   (Omit this section only if the PDF has zero constraints)
      //
      // ### Sample Input
      // ```text
      // <IDENTICAL to testCases[0].input>
      // ```
      //
      // ### Sample Output
      // ```text
      // <IDENTICAL to testCases[0].expected_output>
      // ```
      //
      // ### Explanation
      // <Walk through why the sample output is correct for the sample input>
      //
      // RULES FOR description:
      // R1. Use ONLY standard Markdown (##, ###, -, ```, **bold**). No HTML tags.
      // R2. All section headings listed above are MANDATORY except "Constraints"
      //     (which may be omitted when none exist in the source).
      // R3. The content inside the Sample Input/Output fenced blocks MUST be
      //     character-for-character identical to testCases[0].input / expected_output.
      // R4. Escape every double-quote inside the JSON string value with \".
      //     Represent newlines as the literal two-character sequence \n.
      // R5. Do NOT wrap the JSON in markdown fences. Return raw JSON only.
      // ─────────────────────────────────────────────────────────────────────────

      const ioInstructions =
        {
          java: 'CRITICAL REQUIREMENT: For Java, write a public class named "Main" with a "public static void main(String[] args)" method. Use Scanner or BufferedReader for I/O. Both reference_code and starter_code MUST read user-provided runtime input from stdin and MUST NOT hardcode sample/testcase values. starter_code must still include stdin-reading scaffold with TODO placeholders. Print strictly the expected output to stdout. NO markdown fences.',
          python:
            'CRITICAL REQUIREMENT: For Python, read all inputs using input() or sys.stdin.read(). Both reference_code and starter_code MUST read user-provided runtime input from stdin and MUST NOT hardcode sample/testcase values. starter_code must still include stdin-reading scaffold with TODO placeholders. Print strictly the expected output to stdout. NO markdown fences.',
          cpp: 'CRITICAL REQUIREMENT: For C++, use cin/cout or scanf/printf. Both reference_code and starter_code MUST read user-provided runtime input from stdin and MUST NOT hardcode sample/testcase values. starter_code must still include stdin-reading scaffold with TODO placeholders. Print strictly the expected output to stdout. NO markdown fences.',
          c: 'CRITICAL REQUIREMENT: For C, use scanf/printf. Both reference_code and starter_code MUST read user-provided runtime input from stdin and MUST NOT hardcode sample/testcase values. starter_code must still include stdin-reading scaffold with TODO placeholders. Print strictly the expected output to stdout. NO markdown fences.',
        }[language] ||
        'Both reference_code and starter_code MUST read user-provided runtime input from stdin, MUST NOT hardcode sample/testcase values, and must print strictly the expected output to stdout.';

      const processChunk = async (chunkText, index) => {
        const prompt = isExam
          ? `
You are a precision PDF-to-Code mapping bot for a competitive programming / exam platform.
Analyze the provided exam paper text. The paper typically has multiple SETS (e.g. "Set A", "Set B", etc.), each containing numbered questions with marks.

Your job: Extract ALL questions from ALL sets into a SINGLE JSON object.

════════════════════════════════════════════════
DESCRIPTION FIELD — MANDATORY MARKDOWN FORMAT
════════════════════════════════════════════════
Every level's "description" MUST use this exact Markdown structure (render order matters):

## Problem Statement
<Full verbatim problem statement copied from the PDF, preserving all sub-parts>

## Objective
<One sentence: what the student must implement or compute>

## Input Format
- <Describe each line/value of input, one bullet per line>

## Output Format
- <Describe expected output, one bullet per line>

## Constraints
- <One bullet per constraint, e.g. 1 ≤ N ≤ 10^5>
(Omit this entire section only if the source PDF has no constraints for this problem)

### Sample Input
\`\`\`text
<MUST be character-for-character identical to testCases[0].input>
\`\`\`

### Sample Output
\`\`\`text
<MUST be character-for-character identical to testCases[0].expected_output>
\`\`\`

### Explanation
<Step-by-step walkthrough of why the sample output is correct for the sample input>

DESCRIPTION RULES:
- R1: All sections are MANDATORY except "Constraints" (omit only when source has none).
- R2: Sample Input/Output fenced-block content MUST exactly match testCases[0].
- R3: Use only standard Markdown (##, ###, -, \`\`\`, **bold**). No HTML.
- R4: Inside the JSON string value, escape double-quotes as \\" and encode newlines as \\n.
════════════════════════════════════════════════

OUTPUT JSON STRUCTURE (STRICT - return ONLY raw JSON, no markdown fences, no explanation):
{
  "practicals": [
    {
      "practical_number": 1,
      "title": "Exam",
      "description": "",
      "max_marks": {Total marks of the largest set},
      "duration_minutes": null,
      "enableLevels": true,
      "language": "${language}",
      "levels": [
        {
          "level": "{SetName} - Q{number}",
          "title": "{Unique descriptive title derived from the problem statement}",
          "description": "{FULL Markdown description following the format above — all sections present, newlines as \\n}",
          "max_marks": {Exact marks from PDF},
          "reference_code": "COMPLETE WORKING SOLUTION in ${language.toUpperCase()}. ${ioInstructions}",
          "starter_code": "Incomplete template in ${language.toUpperCase()} with function signature, stdin input-reading scaffold, and TODO comments for student to fill in. ${ioInstructions}",
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
4. **sets[].level_names MUST exactly match levels[].title:** The strings in level_names must be character-for-character identical to the corresponding level's "title" field.
5. **LITERAL MARKS:** Extract exact marks as they appear in the PDF.
6. **Sub-parts:** If a question has sub-parts (a), (b), (c) with separate marks, combine them into ONE level. Include all sub-parts in the Problem Statement section of the description. Sum their marks for max_marks.
7. **NO HALLUCINATIONS:** Use only actual data from the provided text.
8. **reference_code:** Must be complete, compilable ${language.toUpperCase()} code reading user-provided runtime input from stdin and printing to stdout. NEVER initialize variables with sample input data.
9. **starter_code:** Must be an incomplete template with TODO placeholders AND include stdin input-reading scaffold that accepts user-provided runtime input.
10. **I/O CONSISTENCY:** testCases[0].expected_output MUST be the exact literal result of running testCases[0].input through reference_code.

TEXT:
${chunkText}
`
          : `
You are a precision PDF-to-Code mapping bot for a competitive programming platform.
Analyze the provided text and extract ALL coding problems/tasks into a valid JSON object.

════════════════════════════════════════════════
DESCRIPTION FIELD — MANDATORY MARKDOWN FORMAT
════════════════════════════════════════════════
Every practical's "description" MUST use this exact Markdown structure (render order matters):

## Problem Statement
<Full verbatim problem statement copied from the PDF>

## Objective
<One sentence: what the student must implement or compute>

## Input Format
- <Describe each line/value of input, one bullet per line>

## Output Format
- <Describe expected output, one bullet per line>

## Constraints
- <One bullet per constraint, e.g. 1 ≤ N ≤ 10^5>
(Omit this entire section only if the source PDF has no constraints for this problem)

### Sample Input
\`\`\`text
<MUST be character-for-character identical to testCases[0].input>
\`\`\`

### Sample Output
\`\`\`text
<MUST be character-for-character identical to testCases[0].expected_output>
\`\`\`

### Explanation
<Step-by-step walkthrough of why the sample output is correct for the sample input>

DESCRIPTION RULES:
- R1: All sections are MANDATORY except "Constraints" (omit only when source has none).
- R2: Sample Input/Output fenced-block content MUST exactly match testCases[0].
- R3: Use only standard Markdown (##, ###, -, \`\`\`, **bold**). No HTML.
- R4: Inside the JSON string value, escape double-quotes as \\" and encode newlines as \\n.
════════════════════════════════════════════════

OUTPUT JSON STRUCTURE (STRICT - return ONLY raw JSON, no markdown fences, no explanation):
{
  "practicals": [
    {
      "practical_number": {Actual number (e.g. 1)},
      "title": "{Actual Problem Title}",
      "description": "{FULL Markdown description following the format above — all sections present, newlines as \\n}",
      "max_marks": {Actual marks},
      "enableLevels": false,
      "language": "${language}",
      "reference_code": "MANDATORY: Complete ${language.toUpperCase()} solution. ${ioInstructions}",
      "starter_code": "Incomplete template in ${language.toUpperCase()} with function signature, stdin input-reading scaffold, and TODO comments. ${ioInstructions}",
      "testCases": [{ "input": "{input}", "expected_output": "{output}" }]
    }
  ]
}

CRITICAL EXECUTION RULES:
1. **LITERAL MARKS & COUNTS:** Extract exact marks as they appear in the PDF.
2. **DISTINCT PROBLEMS:** Every distinct problem/experiment MUST be a separate entry.
3. **NO HALLUCINATIONS:** Use only actual data from the provided text.
4. **reference_code:** Must be complete, compilable ${language.toUpperCase()} code reading user-provided runtime input from stdin and printing to stdout. NO HARDCODED INPUT.
5. **starter_code:** Must be an incomplete template with TODO placeholders and stdin input-reading scaffold for user-provided runtime input.
6. **I/O CONSISTENCY:** testCases[0].expected_output MUST be the exact literal result of running testCases[0].input through reference_code.

TEXT:
${chunkText}
`;

        try {
          const messages = [{ role: 'user', parts: [{ text: prompt }] }];
          let fullResponse = '';
          const bulkConfig = { ...configOverrides, maxOutputTokens: 65536 };
          await aiService.chat(messages, null, bulkConfig, (chunk) => {
            fullResponse += chunk;
          });

          // Helper to attempt JSON repair with multiple strategies
          const repairJson = (str) => {
            try {
              let cleaned = str
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

              const first = cleaned.indexOf('{');
              const last = cleaned.lastIndexOf('}');
              if (first === -1 || last === -1) {
                logger.debug('repairJson: no { } found in response');
                return null;
              }
              cleaned = cleaned.substring(first, last + 1);

              // Attempt 1: Direct parse
              try {
                return JSON.parse(cleaned);
              } catch (e1) {
                logger.debug(
                  `repairJson attempt 1 (direct): ${e1.message.substring(0, 200)}`
                );
              }

              // Attempt 2: Remove trailing commas (common AI mistake)
              let repaired = cleaned.replace(/,\s*([}\]])/g, '$1');
              try {
                return JSON.parse(repaired);
              } catch (e2) {
                logger.debug(
                  `repairJson attempt 2 (trailing commas): ${e2.message.substring(0, 200)}`
                );
              }

              // Attempt 3: Fix invalid escape sequences (C code in JSON strings)
              // JSON only allows: \" \\ \/ \b \f \n \r \t \uXXXX
              // C code often has: \0 \' \a \v \e \x \( \) \[ \] etc.
              // Strategy: walk through the string character by character,
              // only transforming escapes inside JSON string values.
              try {
                let fixed = '';
                let inString = false;
                let i = 0;
                while (i < repaired.length) {
                  const ch = repaired[i];

                  if (!inString) {
                    if (ch === '"') {
                      inString = true;
                    }
                    fixed += ch;
                    i++;
                  } else {
                    // Inside a JSON string value
                    if (ch === '"') {
                      // End of string
                      inString = false;
                      fixed += ch;
                      i++;
                    } else if (ch === '\\') {
                      // Escape sequence
                      const next = repaired[i + 1];
                      if (next === undefined) {
                        // Trailing backslash — drop it
                        i++;
                      } else if (
                        next === '"' ||
                        next === '\\' ||
                        next === '/' ||
                        next === 'b' ||
                        next === 'f' ||
                        next === 'n' ||
                        next === 'r' ||
                        next === 't'
                      ) {
                        // Valid JSON escape — keep as-is
                        fixed += ch + next;
                        i += 2;
                      } else if (next === 'u') {
                        // \uXXXX — keep if followed by 4 hex digits, else escape
                        const hex = repaired.substring(i + 2, i + 6);
                        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                          fixed += repaired.substring(i, i + 6);
                          i += 6;
                        } else {
                          // Invalid \u sequence — double-escape
                          fixed += '\\\\u';
                          i += 2;
                        }
                      } else {
                        // Invalid escape for JSON (e.g. \0, \', \a, \v, \e, \x, \p, etc.)
                        // Double-escape the backslash so it becomes a literal backslash in the parsed string
                        fixed += '\\\\' + next;
                        i += 2;
                      }
                    } else if (ch.charCodeAt(0) < 0x20) {
                      // Literal control characters inside strings — replace with JSON escapes
                      if (ch === '\n') fixed += '\\n';
                      else if (ch === '\r') fixed += '\\r';
                      else if (ch === '\t') fixed += '\\t';
                      else
                        fixed +=
                          '\\u' +
                          ch.charCodeAt(0).toString(16).padStart(4, '0');
                      i++;
                    } else {
                      fixed += ch;
                      i++;
                    }
                  }
                }
                return JSON.parse(fixed);
              } catch (e3) {
                logger.debug(
                  `repairJson attempt 3 (escape fix): ${e3.message.substring(0, 200)}`
                );
              }

              // Attempt 4: Aggressive — strip everything outside the main JSON structure
              // and retry with the escape-fixed version plus trailing-comma removal
              try {
                let aggressive = repaired
                  .replace(/,\s*([}\]])/g, '$1')
                  // Replace any remaining raw control chars
                  // eslint-disable-next-line no-control-regex
                  .replace(/[\x00-\x1f]/g, (m) => {
                    if (m === '\n' || m === '\r' || m === '\t') return m;
                    return '';
                  });
                // One more pass of the simple regex escape fixer
                aggressive = aggressive.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
                return JSON.parse(aggressive);
              } catch (e4) {
                logger.debug(
                  `repairJson attempt 4 (aggressive): ${e4.message.substring(0, 200)}`
                );
              }

              // Attempt 5: Handle truncated JSON (AI output cut off mid-response)
              // Walk the string tracking open structures, then close them
              try {
                let truncSrc = repaired;
                // Apply escape fixes first
                truncSrc = truncSrc.replace(/\\([^"\\//bfnrtu])/g, '\\\\$1');
                // eslint-disable-next-line no-control-regex
                truncSrc = truncSrc.replace(/[\x00-\x1f]/g, (m) => {
                  if (m === '\n' || m === '\r' || m === '\t') return m;
                  return '';
                });

                let tInStr = false;
                const opens = [];
                for (let ti = 0; ti < truncSrc.length; ti++) {
                  const tc = truncSrc[ti];
                  if (tInStr) {
                    if (tc === '\\' && ti + 1 < truncSrc.length) {
                      ti++; // skip escaped char
                    } else if (tc === '"') {
                      tInStr = false;
                    }
                  } else {
                    if (tc === '"') tInStr = true;
                    else if (tc === '{') opens.push('}');
                    else if (tc === '[') opens.push(']');
                    else if (tc === '}' || tc === ']') opens.pop();
                  }
                }

                // If still open structures, the response was truncated
                if (opens.length > 0 || tInStr) {
                  let suffix = '';
                  if (tInStr) suffix += '"';
                  while (opens.length > 0) suffix += opens.pop();
                  const recovered = truncSrc + suffix;
                  const result = JSON.parse(recovered);
                  logger.info(
                    `repairJson: recovered truncated JSON by closing ${suffix.length} open structures`
                  );
                  return result;
                }
              } catch (e5) {
                logger.debug(
                  `repairJson attempt 5 (truncation recovery): ${e5.message.substring(0, 200)}`
                );
              }

              logger.error(
                `repairJson: all 5 attempts failed. First 500 chars: ${cleaned.substring(0, 500)}`
              );
              return null;
            } catch (_e) {
              logger.error(`repairJson: unexpected error: ${_e.message}`);
              return null;
            }
          };

          logger.info(`Raw AI Response for chunk ${index}:\n${fullResponse}`);
          const parsed = repairJson(fullResponse);

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

          if (p.testCases && p.testCases.length > 0) {
            existing.testCases = [
              ...(existing.testCases || []),
              ...p.testCases,
            ];
          }

          if (p.sets && p.sets.length > 0) {
            const setMap = new Map();
            [...(existing.sets || []), ...(p.sets || [])].forEach((s) => {
              const sKey = s.set_name;
              if (!setMap.has(sKey)) {
                setMap.set(sKey, s);
              } else {
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

      // 5. Post-processing for exams
      if (isExam) {
        practicals = practicals.map((p) => {
          if (!p.levels || p.levels.length === 0) return p;

          const titleCounts = new Map();
          p.levels.forEach((l) => {
            const t = (l.title || l.level || '').trim();
            titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
          });

          const titleSeen = new Map();
          p.levels = p.levels.map((l) => {
            const t = (l.title || l.level || '').trim();
            if (titleCounts.get(t) > 1) {
              const count = (titleSeen.get(t) || 0) + 1;
              titleSeen.set(t, count);
              const levelPrefix = l.level || `Variant ${count}`;
              l.title = `${t} (${levelPrefix})`;
            }
            return l;
          });

          const levelKeyToTitle = new Map();
          p.levels.forEach((l) => {
            if (l.level) levelKeyToTitle.set(l.level, l.title || l.level);
          });

          if (p.sets && p.sets.length > 0) {
            const setPrefix = (setName) => (setName || '').trim();

            p.sets = p.sets.map((s) => {
              const sName = setPrefix(s.set_name);

              const allTitles = new Set(p.levels.map((l) => l.title));
              const validNames = (s.level_names || []).filter((n) =>
                allTitles.has(n)
              );

              if (validNames.length > 0) {
                s.level_names = validNames;
              } else {
                const matchedTitles = p.levels
                  .filter((l) => {
                    const lKey = (l.level || '').toLowerCase();
                    return lKey.startsWith(sName.toLowerCase());
                  })
                  .map((l) => l.title || l.level);

                if (matchedTitles.length > 0) {
                  s.level_names = matchedTitles;
                }
              }

              return s;
            });
          } else {
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
