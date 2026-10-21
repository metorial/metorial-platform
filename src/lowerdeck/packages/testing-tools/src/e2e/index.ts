import { randomBytes } from 'node:crypto';
import { mergeConfig, type ViteUserConfig } from 'vitest/config';
import { baseVitestConfig } from '../vitest/config';

export type EventuallyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

/**
 * Re-runs `fn` until it stops throwing (or returns), then resolves with its result. Rethrows the
 * last error once `timeoutMs` elapses. Meant for side effects of queues, workers and other
 * asynchronous processing.
 */
export let eventually = async <T>(
  fn: () => T | Promise<T>,
  options: EventuallyOptions = {}
): Promise<T> => {
  let timeoutMs = options.timeoutMs ?? 30_000;
  let intervalMs = options.intervalMs ?? 250;
  let deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
};

export let uniqueId = (prefix = 'test') =>
  `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

export let createE2EVitestConfig = (overrides: ViteUserConfig = {}): ViteUserConfig =>
  mergeConfig(
    mergeConfig(baseVitestConfig, {
      test: {
        include: ['e2e/**/*.e2e.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        pool: 'forks',
        testTimeout: 60_000,
        hookTimeout: 120_000,
        fileParallelism: false,
        passWithNoTests: false
      }
    }),
    overrides
  );
