import { describe, expect, test } from 'vitest';
import { enumType } from './enum';

describe('enumType', () => {
  test('should validate a valid value', () => {
    let validator = enumType('foo', 'bar', 'baz');
    let result: any = validator.validate('foo');
    expect(result.success).toBe(true);
    expect(result.value).toBe('foo');
  });

  test('should not validate an invalid value', () => {
    let validator = enumType('foo', 'bar', 'baz');
    let result: any = validator.validate('qux');
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'invalid_enum',
        message: 'Invalid input, expected one of foo, bar, baz, received qux',
        received: 'qux',
        expected: ['foo', 'bar', 'baz']
      }
    ]);
  });
});
