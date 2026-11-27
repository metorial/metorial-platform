import { describe, expect, it } from 'vitest';
import { getInvocationErrorCode } from './error';

describe('getInvocationErrorCode', () => {
  it('prefers the top-level upstream code', () => {
    expect(
      getInvocationErrorCode({
        code: 'request.bad',
        message: 'failed',
        upstreamCode: 'AADSTS700016',
        baggage: { serviceErrorData: { upstreamCode: 'older' } }
      })
    ).toBe('AADSTS700016');
  });

  it('falls back to the upstream code in the baggage of older slates', () => {
    expect(
      getInvocationErrorCode({
        code: 'request.bad',
        message: 'failed',
        baggage: { serviceErrorData: { upstreamCode: 'AADSTS7000229' } }
      })
    ).toBe('AADSTS7000229');
  });

  it('uses the protocol code when no upstream code is reported', () => {
    expect(getInvocationErrorCode({ code: 'request.bad', message: 'failed' })).toBe(
      'request.bad'
    );
    expect(
      getInvocationErrorCode({
        code: 'request.bad',
        message: 'failed',
        upstreamCode: '',
        baggage: { serviceErrorData: { upstreamCode: 42 } }
      })
    ).toBe('request.bad');
  });
});
