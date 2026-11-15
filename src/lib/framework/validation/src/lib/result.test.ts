import { describe, expect, test } from 'vitest';
import { error, success } from './result';

describe('Result', () => {
  test('success should return a successful result', () => {
    let s1 = success({
      foo: 'bar'
    });

    expect(s1).toEqual({
      success: true,
      value: {
        foo: 'bar'
      }
    });

    let s2 = success(123);

    expect(s2).toEqual({
      success: true,
      value: 123
    });
  });

  test('error should return an error result', () => {
    let e1 = error([
      {
        code: 'invalid_type',
        message: 'Invalid type',
        received: 'string',
        expected: 'number'
      }
    ]);

    expect(e1).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid type',
          received: 'string',
          expected: 'number'
        }
      ]
    });

    let e2 = error([
      {
        code: 'invalid_type',
        message: 'Invalid type',
        received: 'string',
        expected: 'number'
      },
      {
        code: 'invalid_type',
        message: 'Invalid type',
        received: 'string',
        expected: 'number'
      }
    ]);

    expect(e2).toEqual({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Invalid type',
          received: 'string',
          expected: 'number'
        },
        {
          code: 'invalid_type',
          message: 'Invalid type',
          received: 'string',
          expected: 'number'
        }
      ]
    });
  });
});
