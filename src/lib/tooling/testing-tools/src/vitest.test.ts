import { describe, expect, test } from 'vitest';
import { createVitestConfig, withAliases, baseVitestConfig } from './vitest/config';
import { loadTestEnv } from './vitest/env';

describe('vitest config helpers', () => {
  test('createVitestConfig returns defaults and merges overrides', () => {
    expect(baseVitestConfig.test?.testTimeout).toBe(30_000);
    const config = createVitestConfig({
      test: {
        testTimeout: 20_000
      }
    });

    expect(config.test?.maxConcurrency).toBe(1);
    expect(config.test?.testTimeout).toBe(20_000);
  });

  test('withAliases merges resolve aliases', () => {
    const config = withAliases(createVitestConfig(), { '@': './src' });

    expect(config.resolve?.alias).toEqual({ '@': './src' });
  });

  test('loadTestEnv reads matching prefixed variables', () => {
    const original = process.env.TESTING_TOOLS_SAMPLE;
    process.env.TESTING_TOOLS_SAMPLE = 'value';

    const env = loadTestEnv('test', process.cwd(), 'TESTING_TOOLS_');

    expect(env.TESTING_TOOLS_SAMPLE).toBe('value');

    if (original === undefined) {
      delete process.env.TESTING_TOOLS_SAMPLE;
    } else {
      process.env.TESTING_TOOLS_SAMPLE = original;
    }
  });
});
