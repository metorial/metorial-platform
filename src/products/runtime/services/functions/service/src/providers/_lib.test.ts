import { describe, expect, it, vi } from 'vitest';
import { parseInvocationPayload } from './_lib';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn()
  })
}));

describe('parseInvocationPayload', () => {
  it('treats Lambda ReferenceError payloads as function errors', () => {
    let res = parseInvocationPayload({
      payload: JSON.stringify({
        errorType: 'ReferenceError',
        errorMessage: 'require is not defined in ES module scope',
        trace: ['ReferenceError: require is not defined in ES module scope']
      }),
      outputs: {
        logs: [],
        computeTimeMs: 10,
        billedTimeMs: 10
      }
    });

    expect(res.type).toBe('error');
    if (res.type !== 'error') throw new Error('Expected parser to return an error');

    expect(res.error.code).toBe('function_bay.function_error');
    expect(res.error.message).toContain('ReferenceError require is not defined');
  });
});
