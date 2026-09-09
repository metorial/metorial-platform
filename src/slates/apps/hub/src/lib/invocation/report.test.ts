import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException: mocks.captureException,
    captureMessage: mocks.captureMessage
  })
}));

import { isJsonRpcServerError, reportSlateInvocationServerError } from './report';

describe('isJsonRpcServerError', () => {
  it('treats JSON-RPC internal and reserved server error codes as server errors', () => {
    expect(isJsonRpcServerError({ code: -32603, message: 'Internal error' })).toBe(true);
    expect(isJsonRpcServerError({ code: -32000, message: 'Server error' })).toBe(true);
    expect(isJsonRpcServerError({ code: -32099 })).toBe(true);
    expect(isJsonRpcServerError({ code: '-32000' })).toBe(true);
    expect(isJsonRpcServerError({ code: 'internal_error' })).toBe(true);
    expect(isJsonRpcServerError({ code: 'internal_server_error' })).toBe(true);
  });

  it('treats Internal server error messages as server errors regardless of code', () => {
    expect(isJsonRpcServerError({ code: 'whatever', message: 'Internal server error' })).toBe(
      true
    );
  });

  it('does not treat expected provider/client errors as server errors', () => {
    expect(isJsonRpcServerError({ code: -32602, message: 'Invalid params' })).toBe(false);
    expect(isJsonRpcServerError({ code: 'invalid_grant', message: 'expired' })).toBe(false);
    expect(isJsonRpcServerError({ code: -32100 })).toBe(false);
    expect(isJsonRpcServerError(null)).toBe(false);
    expect(isJsonRpcServerError('Internal server error')).toBe(false);
  });
});

describe('reportSlateInvocationServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('captures exceptions with invocation context and does not throw', () => {
    let err = new Error('lambda exploded');

    reportSlateInvocationServerError({
      reason: 'invocation_exception',
      invocationId: 'shiv_1',
      invocationOid: 12n,
      slateVersionId: 'shvr_1',
      tenantIdentifier: 'ten_1',
      error: err,
      methods: ['slates/auth.token_refresh.handle']
    });

    expect(mocks.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        extra: expect.objectContaining({
          invocationId: 'shiv_1',
          invocationOid: '12',
          slateVersionId: 'shvr_1',
          tenantIdentifier: 'ten_1'
        })
      })
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('captures JSON-RPC server errors as messages and keeps only recent logs', () => {
    reportSlateInvocationServerError({
      reason: 'jsonrpc_server_error',
      invocationId: 'shiv_2',
      slateVersionId: 'shvr_1',
      providerInvocationId: 'fbiv_1',
      error: [{ code: -32000, message: 'Internal server error' }],
      logs: Array.from({ length: 60 }, (_, i) => ({ timestamp: i, message: `log ${i}` }))
    });

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Slate invocation server error (jsonrpc_server_error)',
      expect.objectContaining({
        level: 'error',
        extra: expect.objectContaining({
          invocationId: 'shiv_2',
          providerInvocationId: 'fbiv_1',
          logs: expect.arrayContaining([{ timestamp: 59, message: 'log 59' }])
        })
      })
    );

    let extra = mocks.captureMessage.mock.calls[0]![1].extra;
    expect(extra.logs).toHaveLength(50);
    expect(extra.logs[0]).toEqual({ timestamp: 10, message: 'log 10' });
  });

  it('logs but does not report to Sentry when suppressSentry is set', () => {
    let err = new Error('lambda exploded again');

    reportSlateInvocationServerError({
      reason: 'invocation_exception',
      invocationId: 'shiv_3',
      slateVersionId: 'shvr_1',
      error: err,
      suppressSentry: true
    });

    reportSlateInvocationServerError({
      reason: 'jsonrpc_server_error',
      invocationId: 'shiv_4',
      slateVersionId: 'shvr_1',
      error: [{ code: -32000, message: 'Internal server error' }],
      suppressSentry: true
    });

    expect(mocks.captureException).not.toHaveBeenCalled();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
