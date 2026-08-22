import { describe, expect, it } from 'vitest';
import { sanitizeScopedInvocationValue } from './types';

describe('sanitizeScopedInvocationValue', () => {
  it('redacts scoped secrets across persisted invocation artifacts', () => {
    let receiverSecret = 'receiver-secret';
    let redeemedSecret = 'redeemed-secret';
    let result = sanitizeScopedInvocationValue(
      {
        requests: [{ url: `/webhook/${receiverSecret}` }],
        responses: [{ body: `accepted ${redeemedSecret}` }],
        logs: [[1, `received ${receiverSecret} and ${redeemedSecret}`]],
        errors: [new Error(`failed for ${receiverSecret}`)],
        safe: { message: 'preserved', count: 1 }
      },
      {
        redactionSentinels: [receiverSecret],
        forbiddenValues: [redeemedSecret]
      }
    );

    expect(result.requests).toEqual([{ url: '/webhook/[REDACTED]' }]);
    expect(result.responses).toEqual([{ body: 'accepted [REDACTED]' }]);
    expect(result.logs).toEqual([[1, 'received [REDACTED] and [REDACTED]']]);
    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0]?.message).toBe('failed for [REDACTED]');
    expect(result.safe).toEqual({ message: 'preserved', count: 1 });
    expect(JSON.stringify(result)).not.toContain(receiverSecret);
    expect(JSON.stringify(result)).not.toContain(redeemedSecret);
  });
});
