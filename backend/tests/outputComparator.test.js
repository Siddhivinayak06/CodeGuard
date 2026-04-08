const {
  compareOutput,
  COMPARISON_MODES,
} = require('../src/utils/execution/outputComparator');

describe('outputComparator lenient matching', () => {
  it('matches when case and punctuation differ', () => {
    const actual = 'Hello, WORLD!!!';
    const expected = 'hello world';

    const result = compareOutput(
      actual,
      expected,
      COMPARISON_MODES.IGNORE_CASE_PUNCTUATION
    );

    expect(result.match).toBe(true);
  });

  it('ignore_trailing_whitespace mode is now case/punctuation lenient', () => {
    const actual = 'TOTAL: 42.';
    const expected = 'total 42';

    const result = compareOutput(
      actual,
      expected,
      COMPARISON_MODES.IGNORE_TRAILING_WS
    );

    expect(result.match).toBe(true);
  });

  it('keyword mode matches regardless of order/case/punctuation', () => {
    const actual = 'Result => Passed; score: 95 out of 100';
    const expected = 'passed score 95';

    const result = compareOutput(
      actual,
      expected,
      COMPARISON_MODES.KEYWORD_CONTAINS
    );

    expect(result.match).toBe(true);
  });

  it('ignore_case_punctuation mode falls back to keyword matching', () => {
    const actual = 'The submission has PASSED with score: 95 out of 100.';
    const expected = 'passed score 95';

    const result = compareOutput(
      actual,
      expected,
      COMPARISON_MODES.IGNORE_CASE_PUNCTUATION
    );

    expect(result.match).toBe(true);
  });

  it('keyword mode fails when required keywords are missing', () => {
    const actual = 'Result => Passed; score: 95 out of 100';
    const expected = 'passed score 95 bonus';

    const result = compareOutput(
      actual,
      expected,
      COMPARISON_MODES.KEYWORD_CONTAINS
    );

    expect(result.match).toBe(false);
  });
});

describe('outputComparator strict mode', () => {
  it('does not ignore punctuation/case in strict mode', () => {
    const actual = 'Hello, WORLD!!!';
    const expected = 'hello world';

    const result = compareOutput(actual, expected, COMPARISON_MODES.STRICT);
    expect(result.match).toBe(false);
  });
});
