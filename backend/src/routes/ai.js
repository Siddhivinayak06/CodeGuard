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

      // 2. Construct Prompt for Bulk Extraction
      const prompt = `
You are an expert curriculum designer. Extract ALL practical experiments from the provided text.

OUTPUT FORMAT:
Return a valid JSON array of objects. Each object represents a PRACTICAL.
If an "Experiment" contains multiple "Tasks" or "Programs", it is a MULTI-LEVEL practical.

Structure for Single-Level Practical (One task/experiment):
{
  "title": "Experiment Title",
  "description": "Full problem description",
  "max_marks": 10,
  "language": "c", // Inferred language: "c", "cpp", "java", "python", "javascript"
  "reference_code": "// Optional starter code if present in PDF",
  "enableLevels": false,
  "testCases": [
    { "input": "...", "expected_output": "..." } // 3-5 diverse cases
  ]
}

Structure for Multi-Level Practical (Multiple tasks in one experiment):
{
  "title": "Experiment Title (e.g. Experiment 1)",
Return a JSON object with this structure:
{
  "practicals": [
    {
      "practical_number": 1, // The experiment number (e.g., 1, 2, 3)
      "title": "Title of the practical", // DO NOT include "Experiment 1" here. Just the title.
      "description": "Detailed problem statement, including Input/Output format, constraints, and examples.",
      "max_marks": 10,
      "enableLevels": false, // boolean
      "levels": [], // if enableLevels is true
      "language": "c", // inferred programming language (c, cpp, java, python)
      "reference_code": "// REQUIRED: Write a complete, correct solution code for this problem. This code is used to validate test cases entered by faculty.",
      "testCases": [
        {
          "input": "Input string",
          "expected_output": "Expected output string"
        }
      ]
    }
  ]
}

CRITICAL INSTRUCTIONS:
- Ensure the JSON is valid.
- **EXTRACT PRACTICAL NUMBER:**
  - Look for "Exp No", "Experiment 1", "1. ", etc.
  - Put the NUMBER (e.g., 1) in \`practical_number\`.
  - Put the REST of the title in \`title\`.
  - Example: "1. Write a program..." -> practical_number: 1, title: "Write a program..."
- **GROUP TASKS BY EXPERIMENT NUMBER:**
  - This is a table. "Exp No" is the key. Everything following an "Exp No" (until the next number) belongs to that experiment.
  - **CRITICAL:** If an Experiment Number corresponds to MULTIPLE problem statements, sub-questions, or tasks, you MUST combine them into ONE practical with \`enableLevels: true\`.
  - **Look for these patterns under a single Exp No:**
    - "Task 1", "Task 2" ...
    - "a)", "b)", "c)" ...
    - "i.", "ii.", "iii." ...
    - Multiple bullet points each describing a separate program.
  - **Example (e.g., if Experiment Number is 5):**
    Input Text:
    "5  Task A: Write a program to... \n Task B: Write another program to..."
    Output JSON:
    {
      "practical_number": 5,
      "title": "Combined Title (short summary)",
      "enableLevels": true,
      "levels": [
        { 
          "title": "Task A: Write a program...", 
          "description": "Detailed description of Task A including constraints and IO format",
          "max_marks": 5,
          "reference_code": "// Code for Task A",
          "testCases": [] 
        },
        { 
          "title": "Task B: Write another program...", 
          "description": "Detailed description of Task B including constraints and IO format",
          "max_marks": 5,
          "reference_code": "// Code for Task B",
          "testCases": []
        }
      ]
    }
- **STRICT RULE:** 
  - 2 or more sub-tasks -> \`enableLevels: true\`
  - 1 single task -> \`enableLevels: false\`
- **DESCRIPTION QUALITY:**
  - MUST be detailed. Do NOT summarize into one line.
  - Include "Input Format", "Output Format", and "Constraints" sections if inferred from text.
- Ignore curriculum mapping codes (e.g., "CO1", "BL3", "PO2").
- Do NOT include markdown formatting.
- Ensure test cases are accurate.
- **EXTRACT EVERY SINGLE EXPERIMENT.** Do not skip any. If there are 15 experiments, return 15 objects.
- If the text is long, process it completely.
- **INFER THE PROGRAMMING LANGUAGE.** Look for keywords like "C Program", "Java Program", etc. Default to "c" if unsure.
- **EXTRACT REFERENCE CODE.** If the PDF contains code snippets for the solution, include them in \`reference_code\`. If not, leave empty or provide a minimal starter template.

TEXT TO ANALYZE:
${text.slice(0, 100000)} {/* Limit text length to avoid token limits */}
`;

      const messages = [{ role: 'user', parts: [{ text: prompt }] }];
      const config = req.body.config ? JSON.parse(req.body.config) : {};

      // Buffer the streaming response
      let fullResponse = '';

      await aiService.chat(messages, null, config, (chunk) => {
        fullResponse += chunk;
      });

      // 3. Parse JSON from LLM response
      let jsonStr = fullResponse;
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');

      // Find the array part
      const firstBracket = jsonStr.indexOf('[');
      const lastBracket = jsonStr.lastIndexOf(']');

      if (firstBracket !== -1 && lastBracket !== -1) {
        const potentialJson = jsonStr.substring(firstBracket, lastBracket + 1);
        try {
          const practicals = JSON.parse(potentialJson);
          return res.json({ practicals });
        } catch (e) {
          logger.error('Failed to parse AI response as JSON', { error: e.message, fullResponse });
          // Debugging: Write failed response to file
          const fs = require('fs');
          fs.writeFileSync('debug_ai_response.log', fullResponse);

          return res
            .status(500)
            .json({ error: 'Failed to parse AI response. The AI might have returned invalid JSON.', raw: fullResponse });
        }
      } else {
        logger.error('Failed to find JSON array in AI response', { fullResponse });
        return res
          .status(500)
          .json({ error: 'Failed to parse AI response', raw: fullResponse });
      }
    } catch (err) {
      logger.error('Bulk Generation Error:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
);

module.exports = router;
