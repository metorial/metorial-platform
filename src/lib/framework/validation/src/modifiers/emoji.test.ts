import { describe, expect, test } from 'vitest';
import { emoji } from './emoji';

describe('emoji', () => {
  let validate = emoji();

  test('should return no errors for valid emoji', () => {
    let result = validate('😀');
    expect(result).toEqual([]);
  });

  test('should return an error for invalid emoji', () => {
    let result = validate('not an emoji');
    expect(result).toEqual([
      {
        code: 'invalid_emoji',
        message: 'Invalid emoji'
      }
    ]);
  });

  test('should allow custom error messages', () => {
    let result = emoji({ message: 'Custom error message' })('not an emoji');
    expect(result).toEqual([
      {
        code: 'invalid_emoji',
        message: 'Custom error message'
      }
    ]);
  });
});
