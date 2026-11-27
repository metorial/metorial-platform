import { describe, expect, it } from 'vitest';
import {
  applyCarriageReturns,
  getDisplayLength,
  linesToPlainText,
  MAX_RENDERED_CHARS,
  stripAnsi,
  truncateForDisplay
} from './text';

describe('log text helpers', () => {
  it('strips ANSI color and cursor sequences', () => {
    expect(stripAnsi('\u001b[34m#5\u001b[0m RUN \u001b[1;33mmake\u001b[0m')).toBe(
      '#5 RUN make'
    );
    expect(stripAnsi('plain')).toBe('plain');
  });

  it('applies carriage returns like a terminal overwriting the line', () => {
    expect(applyCarriageReturns('10%\r50%\r100%')).toBe('100%');
    expect(applyCarriageReturns('abcdef\rxy')).toBe('xycdef');
    expect(applyCarriageReturns('no returns')).toBe('no returns');
  });

  it('drops the carriage return left behind by CRLF line endings', () => {
    expect(truncateForDisplay('hello\r')).toBe('hello');
    expect(
      linesToPlainText([
        { index: 0, text: 'a\r' },
        { index: 1, text: 'b' }
      ])
    ).toBe('a\nb');
  });

  it('truncates very long lines without leaving half an escape sequence behind', () => {
    let text = 'x'.repeat(MAX_RENDERED_CHARS - 2) + '\u001b[31mred';
    let result = truncateForDisplay(text);

    expect(result.endsWith(' …')).toBe(true);
    expect(result).not.toContain('\u001b');
    expect(truncateForDisplay('short')).toBe('short');
  });

  it('measures the visible width of a line, expanding tabs and ignoring colors', () => {
    expect(getDisplayLength({ index: 0, text: '\u001b[32mok\u001b[0m' })).toBe(2);
    expect(getDisplayLength({ index: 1, text: 'a\tb' })).toBe(6);
    expect(getDisplayLength({ index: 2, text: 'x'.repeat(50_000) })).toBe(
      MAX_RENDERED_CHARS + 2
    );
  });

  it('joins lines into copyable plain text', () => {
    expect(
      linesToPlainText([
        { index: 0, text: '\u001b[31merror\u001b[0m' },
        { index: 1, text: 'done' }
      ])
    ).toBe('error\ndone');
  });
});
