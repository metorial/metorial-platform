import { isServiceError } from '@lowerdeck/error';
import { expect } from 'vitest';

export let expectServiceError = async (promise: Promise<unknown>, code: string) => {
  let error = await promise.then(
    () => undefined,
    e => e
  );

  expect(isServiceError(error), `expected a service error, got ${String(error)}`).toBe(true);
  expect(error.data.code).toBe(code);
};

export let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let eventually = async <T>(fn: () => Promise<T>, timeoutMs: number = 3000) => {
  let deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await sleep(50);
    }
  }
};
