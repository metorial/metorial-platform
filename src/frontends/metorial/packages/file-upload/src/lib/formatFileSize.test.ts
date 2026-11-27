import { describe, expect, it } from 'vitest';
import { formatFileSize } from './formatFileSize';

describe('formatFileSize', () => {
  it('shows bytes below one KB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('scales through units with one decimal and no trailing zero', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(4.2 * 1024 * 1024)).toBe('4.2 MB');
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50 MB');
  });

  it('drops decimals for values of 100 or more', () => {
    expect(formatFileSize(250 * 1024)).toBe('250 KB');
  });

  it('caps at terabytes', () => {
    expect(formatFileSize(5 * 1024 ** 4)).toBe('5 TB');
    expect(formatFileSize(2048 * 1024 ** 4)).toBe('2048 TB');
  });

  it('returns a dash for invalid input', () => {
    expect(formatFileSize(-1)).toBe('—');
    expect(formatFileSize(Number.NaN)).toBe('—');
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
