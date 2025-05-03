import { v } from '@metorial/validation';
import { describe, expect, test } from 'vitest';
import { createValidatedEnv } from './env';

describe('createValidatedEnv', () => {
  test('validates env', () => {
    process.env.PORT = '3000';
    process.env.TEST = 'true';
    process.env.TEST2 = 'false';
    process.env.HELLO = 'world';

    let env = createValidatedEnv({
      test: {
        PORT: v.string(),
        TEST: v.boolean()
      },
      test2: {
        TEST2: v.boolean()
      },
      hello: {
        HELLO: v.string()
      }
    });

    expect(env).toEqual({
      test: {
        PORT: '3000',
        TEST: true
      },
      test2: {
        TEST2: false
      },
      hello: {
        HELLO: 'world'
      }
    });
  });
});
