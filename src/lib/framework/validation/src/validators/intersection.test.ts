import { describe, expect, test } from 'vitest';
import { success } from '../lib/result';
import { number, object, string } from './index';
import { intersection } from './intersection';

describe('intersection', () => {
  test('intersection - success', () => {
    const validatorA = object({ name: string() });
    const validatorB = object({ age: number() });

    const validator = intersection([validatorA, validatorB]);

    const value = { name: 'John', age: 30, email: 'john@example.com' };
    const result = validator.validate(value);

    expect(result).toEqual(
      success({
        name: 'John',
        age: 30
      })
    );
  });

  test('intersection - failure', () => {
    const validatorA = object({ name: string() });
    const validatorB = object({ age: number() });

    const validator = intersection([validatorA, validatorB]);

    const value = { name: 'John', age: 'test', email: 'john@example.com' };
    const result = validator.validate(value);

    expect(result.success).toBe(false);
  });
});
