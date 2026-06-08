import { describe, expect, test } from 'vitest';
import { any } from './any';

describe('any', () => {
  test('should always return success with the input value', () => {
    let input = 'hello world';
    let result: any = any({}).validate(input);
    expect(result.success).toBe(true);
    expect(result.value).toBe(input);
  });
});
