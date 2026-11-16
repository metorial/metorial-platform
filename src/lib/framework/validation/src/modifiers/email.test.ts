import { describe, expect, test } from 'vitest';
import { email } from './email';

describe('email', () => {
  test('returns an empty array for a valid email address', () => {
    let result = email()('test@example.com');
    expect(result).toEqual([]);
  });

  test('returns an error object for an invalid email address', () => {
    let result = email()('not_an_email');
    expect(result).toEqual([
      {
        code: 'invalid_email',
        message: 'Invalid email address'
      }
    ]);
  });

  test('returns a custom error message if provided', () => {
    let result = email({ message: 'Custom error message' })('not_an_email');
    expect(result).toEqual([
      {
        code: 'invalid_email',
        message: 'Custom error message'
      }
    ]);
  });
});
