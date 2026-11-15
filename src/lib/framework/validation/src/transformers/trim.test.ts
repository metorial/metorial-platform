import { describe, expect, test } from 'vitest';
import { trim, trimEnd, trimStart } from './trim';

describe('trim', () => {
  test('should trim whitespace from both ends of the string', () => {
    expect(trim('  hello  ')).toBe('hello');
  });

  test('should return an empty string if given an empty string', () => {
    expect(trim('')).toBe('');
  });
});

describe('trimStart', () => {
  test('should trim whitespace from the beginning of the string', () => {
    expect(trimStart('  hello')).toBe('hello');
  });

  test('should return an empty string if given an empty string', () => {
    expect(trimStart('')).toBe('');
  });
});

describe('trimEnd', () => {
  test('should trim whitespace from the end of the string', () => {
    expect(trimEnd('hello  ')).toBe('hello');
  });

  test('should return an empty string if given an empty string', () => {
    expect(trimEnd('')).toBe('');
  });
});
