import { v } from '@lowerdeck/validation';
import { afterEach, describe, expect, test } from 'vitest';
import { createValidatedEnv } from './env';

let schema = {
  service: {
    OFFLINE_TEST_STRING: v.string(),
    OFFLINE_TEST_NUMBER: v.number(),
    OFFLINE_TEST_BOOLEAN: v.boolean(),
    OFFLINE_TEST_ENUM: v.enumOf(['development', 'production']),
    OFFLINE_TEST_OPTIONAL: v.optional(v.string())
  }
};

afterEach(() => {
  delete process.env.LOWERDECK_OFFLINE;
});

describe('createValidatedEnv', () => {
  test('throws on missing values', () => {
    expect(() => createValidatedEnv(schema)).toThrow('ENV VALIDATION: OFFLINE_TEST_STRING');
  });

  test('fills typed placeholders in offline mode', () => {
    process.env.LOWERDECK_OFFLINE = '1';

    expect(createValidatedEnv(schema)).toEqual({
      service: {
        OFFLINE_TEST_STRING: 'offline-OFFLINE_TEST_STRING',
        OFFLINE_TEST_NUMBER: 0,
        OFFLINE_TEST_BOOLEAN: false,
        OFFLINE_TEST_ENUM: 'development',
        OFFLINE_TEST_OPTIONAL: undefined
      }
    });
  });
});
