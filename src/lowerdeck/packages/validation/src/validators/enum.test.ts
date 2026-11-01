import { describe, expect, expectTypeOf, test } from 'vitest';
import type { ValidationTypeValue } from '../lib/types';
import { enumOf } from './enum';

describe('enumOf', () => {
  test('should validate a valid value', () => {
    let validator = enumOf(['foo', 'bar', 'baz']);
    let result: any = validator.validate('foo');
    expect(result.success).toBe(true);
    expect(result.value).toBe('foo');
  });

  test('should not validate an invalid value', () => {
    let validator = enumOf(['foo', 'bar', 'baz']);
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

  test('infers every literal in an inline array', () => {
    let validator = enumOf(['foo', 'bar', 'baz']);

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<
      'foo' | 'bar' | 'baz'
    >();
  });

  test('supports mutable arrays without a non-empty tuple assertion', () => {
    let values: ('foo' | 'bar')[] = ['foo', 'bar'];
    let validator = enumOf(values);

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<'foo' | 'bar'>();
    expect(validator.validate('bar')).toEqual({ success: true, value: 'bar' });
    expect(validator.validate('baz').success).toBe(false);
  });

  test('supports readonly tuples and preserves metadata', () => {
    let values = Object.freeze(['foo', 'bar'] as const);
    let validator = enumOf(values, { name: 'Status', description: 'Allowed statuses' });

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<'foo' | 'bar'>();
    expect(validator).toMatchObject({
      type: 'enum',
      name: 'Status',
      description: 'Allowed statuses',
      examples: ['foo', 'bar']
    });
    expect(validator.validate('foo')).toEqual({ success: true, value: 'foo' });
    expect(validator.validate('baz').success).toBe(false);
  });

  test('supports readonly arrays', () => {
    let values: readonly ('foo' | 'bar')[] = ['foo', 'bar'];
    let validator = enumOf(values);

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<'foo' | 'bar'>();
    expect(validator.validate('bar')).toEqual({ success: true, value: 'bar' });
  });

  test('supports computed arrays from enum values', () => {
    enum Status {
      Pending = 'pending',
      Complete = 'complete'
    }

    let validator = enumOf(Object.values(Status));

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<Status>();
    expect(validator.validate('pending')).toEqual({ success: true, value: Status.Pending });
    expect(validator.validate('unknown').success).toBe(false);
  });

  test('supports unions of readonly tuples', () => {
    let selectValues = (extended: boolean) =>
      extended ? (['foo', 'bar', 'baz'] as const) : (['foo'] as const);

    let validator = enumOf(selectValues(false));

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<
      'foo' | 'bar' | 'baz'
    >();
    expect(validator.validate('foo')).toEqual({ success: true, value: 'foo' });
    expect(validator.validate('bar').success).toBe(false);
  });

  test('supports mixed string, number, and boolean literals without coercion', () => {
    let validator = enumOf(['foo', 1, true, false]);

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<'foo' | 1 | boolean>();

    for (let value of ['foo', 1, true, false]) {
      expect(validator.validate(value)).toEqual({ success: true, value });
    }

    for (let value of ['1', 'true', 0, null, undefined, {}]) {
      expect(validator.validate(value).success).toBe(false);
    }
  });

  test('an empty array rejects every input', () => {
    let validator = enumOf([]);

    expectTypeOf<ValidationTypeValue<typeof validator>>().toEqualTypeOf<never>();
    expect(validator.examples).toEqual([]);

    for (let value of ['foo', 1, true, null, undefined]) {
      expect(validator.validate(value).success).toBe(false);
    }
  });
});
