/**
 * Multi-mode output comparison engine.
 *
 * Supports 7 comparison modes:
 *   - strict:                      Byte-for-byte after trimming trailing whitespace per line
 *   - ignore_trailing_whitespace:  Trim trailing whitespace per line, then compare (DEFAULT)
 *   - ignore_all_whitespace:       Strip ALL whitespace, then compare
 *   - float_tolerance:             Parse numbers, compare with epsilon
 *   - unordered_lines:             Sort lines, then compare
 *   - ignore_case_punctuation:     Ignore case and punctuation, compare normalized text
 *   - keyword_contains:            Validate expected keywords exist in actual output
 */

const COMPARISON_MODES = Object.freeze({
  STRICT: 'strict',
  IGNORE_TRAILING_WS: 'ignore_trailing_whitespace',
  IGNORE_ALL_WS: 'ignore_all_whitespace',
  FLOAT_TOLERANCE: 'float_tolerance',
  UNORDERED_LINES: 'unordered_lines',
  IGNORE_CASE_PUNCTUATION: 'ignore_case_punctuation',
  KEYWORD_CONTAINS: 'keyword_contains',
});

const DEFAULT_FLOAT_EPSILON = 1e-6;

// ANSI escape sequence pattern (colors/cursor controls) that should never affect judging.
const ANSI_ESCAPE_REGEX = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`,
  'g'
);

// Invisible characters that frequently sneak in from copied expected outputs.
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF]/g;

function sanitizeOutput(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\0/g, '')
    .replace(ANSI_ESCAPE_REGEX, '')
    .replace(INVISIBLE_CHARS_REGEX, '')
    .normalize('NFKC');
}

function collapseWhitespace(text) {
  return sanitizeOutput(text).replace(/\s+/g, ' ').trim();
}

/**
 * Normalize output by trimming trailing whitespace per line and trimming the whole result.
 * This is the standard "lenient" normalization used by most online judges.
 */
function normalizeTrailingWhitespace(text) {
  return sanitizeOutput(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Strip ALL whitespace from a string.
 */
function stripAllWhitespace(text) {
  return sanitizeOutput(text).replace(/\s+/g, '');
}

/**
 * Lowercase and strip punctuation to compare semantically similar text.
 */
function normalizeCaseAndPunctuation(text) {
  return sanitizeOutput(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeKeywords(text, minLen = 2) {
  const normalized = normalizeCaseAndPunctuation(text);
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.filter(
    (token) => token.length >= minLen || /^\d+$/.test(token)
  );
}

function compareKeywordContains(actual, expected, options = {}) {
  const minKeywordLength = Number(options.minKeywordLength ?? 2);
  const keywordThreshold = Number(options.keywordThreshold ?? 1);

  const expectedTokens = Array.from(
    new Set(tokenizeKeywords(expected, minKeywordLength))
  );

  if (expectedTokens.length === 0) {
    const a = normalizeCaseAndPunctuation(actual);
    const e = normalizeCaseAndPunctuation(expected);
    return {
      match: a === e,
      details: a === e ? 'Match (no expected keywords)' : 'Output differs',
    };
  }

  const actualTokens = new Set(tokenizeKeywords(actual, minKeywordLength));
  const matched = expectedTokens.filter((token) => actualTokens.has(token));
  const ratio = matched.length / expectedTokens.length;
  const required = Math.max(0, Math.min(1, keywordThreshold));
  const missing = expectedTokens.filter((token) => !actualTokens.has(token));

  return {
    match: ratio >= required,
    details:
      ratio >= required
        ? `Match (keywords ${matched.length}/${expectedTokens.length})`
        : `Missing keywords: ${missing.slice(0, 8).join(', ')}`,
  };
}

/**
 * Compare two strings as lines of floating-point numbers.
 * Each line is split by whitespace into tokens. Tokens that parse as numbers
 * are compared with epsilon tolerance; non-numeric tokens are compared exactly.
 */
function compareWithFloatTolerance(
  actual,
  expected,
  epsilon = DEFAULT_FLOAT_EPSILON
) {
  const actualLines = normalizeTrailingWhitespace(actual).split('\n');
  const expectedLines = normalizeTrailingWhitespace(expected).split('\n');

  if (actualLines.length !== expectedLines.length) {
    return {
      match: false,
      details: `Line count mismatch: got ${actualLines.length}, expected ${expectedLines.length}`,
    };
  }

  for (let i = 0; i < actualLines.length; i++) {
    const actualTokens = actualLines[i].trim().split(/\s+/);
    const expectedTokens = expectedLines[i].trim().split(/\s+/);

    if (actualTokens.length !== expectedTokens.length) {
      return {
        match: false,
        details: `Line ${i + 1}: token count mismatch (got ${actualTokens.length}, expected ${expectedTokens.length})`,
      };
    }

    for (let j = 0; j < actualTokens.length; j++) {
      const aNum = parseFloat(actualTokens[j]);
      const eNum = parseFloat(expectedTokens[j]);

      if (!isNaN(aNum) && !isNaN(eNum)) {
        // Both are numbers — compare with tolerance
        if (Math.abs(aNum - eNum) > epsilon) {
          return {
            match: false,
            details: `Line ${i + 1}, token ${j + 1}: ${actualTokens[j]} ≠ ${expectedTokens[j]} (diff ${Math.abs(aNum - eNum)} > ε ${epsilon})`,
          };
        }
      } else if (actualTokens[j] !== expectedTokens[j]) {
        // Not both numbers — compare as strings
        return {
          match: false,
          details: `Line ${i + 1}, token ${j + 1}: "${actualTokens[j]}" ≠ "${expectedTokens[j]}"`,
        };
      }
    }
  }

  return { match: true, details: 'All tokens match within tolerance' };
}

/**
 * Compare output with unordered line matching.
 * Sort both outputs by line, then compare.
 */
function compareUnorderedLines(actual, expected) {
  const actualLines = normalizeTrailingWhitespace(actual).split('\n').sort();
  const expectedLines = normalizeTrailingWhitespace(expected)
    .split('\n')
    .sort();

  if (actualLines.length !== expectedLines.length) {
    return {
      match: false,
      details: `Line count mismatch: got ${actualLines.length}, expected ${expectedLines.length}`,
    };
  }

  for (let i = 0; i < actualLines.length; i++) {
    if (actualLines[i] !== expectedLines[i]) {
      return {
        match: false,
        details: `Sorted line ${i + 1}: "${actualLines[i]}" ≠ "${expectedLines[i]}"`,
      };
    }
  }

  return { match: true, details: 'All lines match (unordered)' };
}

/**
 * Compare actual output against expected output using the specified mode.
 *
 * @param {string} actual        - The actual stdout from the user's program
 * @param {string} expected      - The expected output from test case / reference code
 * @param {string} [mode]        - Comparison mode (default: 'ignore_trailing_whitespace')
 * @param {Object} [options]     - Additional options
 * @param {number} [options.floatTolerance] - Epsilon for float_tolerance mode
 * @returns {{ match: boolean, details: string }}
 */
function compareOutput(actual, expected, mode, options = {}) {
  const effectiveMode = mode || COMPARISON_MODES.IGNORE_TRAILING_WS;

  switch (effectiveMode) {
    case COMPARISON_MODES.STRICT: {
      const a = normalizeTrailingWhitespace(actual);
      const e = normalizeTrailingWhitespace(expected);
      const match = a === e;
      return {
        match,
        details: match ? 'Exact match' : 'Output differs',
      };
    }

    case COMPARISON_MODES.IGNORE_TRAILING_WS: {
      const a = normalizeTrailingWhitespace(actual);
      const e = normalizeTrailingWhitespace(expected);
      const normalizedA = normalizeCaseAndPunctuation(a);
      const normalizedE = normalizeCaseAndPunctuation(e);
      const match =
        a === e ||
        collapseWhitespace(a) === collapseWhitespace(e) ||
        normalizedA === normalizedE;
      return {
        match,
        details: match
          ? 'Match (whitespace/invisible chars/case/punctuation normalized)'
          : 'Output differs',
      };
    }

    case COMPARISON_MODES.IGNORE_ALL_WS: {
      const a = stripAllWhitespace(actual);
      const e = stripAllWhitespace(expected);
      const match = a === e;
      return {
        match,
        details: match ? 'Match (all whitespace ignored)' : 'Output differs',
      };
    }

    case COMPARISON_MODES.FLOAT_TOLERANCE: {
      const epsilon = options.floatTolerance ?? DEFAULT_FLOAT_EPSILON;
      return compareWithFloatTolerance(actual, expected, epsilon);
    }

    case COMPARISON_MODES.UNORDERED_LINES: {
      return compareUnorderedLines(actual, expected);
    }

    case COMPARISON_MODES.IGNORE_CASE_PUNCTUATION: {
      const a = normalizeCaseAndPunctuation(actual);
      const e = normalizeCaseAndPunctuation(expected);
      if (a === e) {
        return {
          match: true,
          details: 'Match (case/punctuation ignored)',
        };
      }

      const keywordFallback = compareKeywordContains(actual, expected, options);
      return {
        match: keywordFallback.match,
        details: keywordFallback.match
          ? 'Match (keyword fallback)'
          : 'Output differs',
      };
    }

    case COMPARISON_MODES.KEYWORD_CONTAINS: {
      return compareKeywordContains(actual, expected, options);
    }

    default: {
      // Fallback to ignore_trailing_whitespace
      const a = normalizeTrailingWhitespace(actual);
      const e = normalizeTrailingWhitespace(expected);
      const match =
        a === e ||
        normalizeCaseAndPunctuation(a) === normalizeCaseAndPunctuation(e);
      return {
        match,
        details: match ? 'Match (fallback)' : 'Output differs',
      };
    }
  }
}

module.exports = {
  COMPARISON_MODES,
  compareOutput,
  normalizeTrailingWhitespace,
  DEFAULT_FLOAT_EPSILON,
};
