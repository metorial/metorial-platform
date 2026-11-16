import { beforeEach, describe, expect, it, vi } from 'vitest';

let { captureException } = vi.hoisted(() => ({
  captureException: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException
  })
}));

import { reportConnectionError } from '../src/hono';

let createAbortError = (message = 'The connection was closed.') => {
  let error = new Error(message);
  error.name = 'AbortError';
  return error;
};

describe('reportConnectionError', () => {
  beforeEach(() => {
    captureException.mockClear();
  });

  it('does not report expected connection abort errors', () => {
    reportConnectionError(createAbortError());

    expect(captureException).not.toHaveBeenCalled();
  });

  it('does not report wrapped connection abort errors', () => {
    let error = new Error('Proxy request failed');
    (error as Error & { cause?: unknown }).cause = createAbortError();

    reportConnectionError(error);

    expect(captureException).not.toHaveBeenCalled();
  });

  it('still reports non-abort errors', () => {
    let error = new Error('boom');

    reportConnectionError(error);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({
          source: undefined,
          thrownType: 'object'
        })
      })
    );
  });

  it('still reports abort errors with unexpected messages', () => {
    reportConnectionError(createAbortError('Request timed out'));

    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
