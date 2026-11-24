import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  class QueueRetryError extends Error {}

  return {
    QueueRetryError,
    handler: null as null | ((data: any, job: any) => Promise<void>),
    configFindUnique: vi.fn(),
    configUpdateMany: vi.fn(async () => ({ count: 1 })),
    versionFindUnique: vi.fn(),
    sendUpdatedConfig: vi.fn(),
    recordSlateError: vi.fn(async () => {})
  };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({
    add: vi.fn(),
    process: (handler: any) => {
      mocks.handler = handler;
      return {};
    }
  }),
  QueueRetryError: mocks.QueueRetryError
}));

vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));

vi.mock('../../db', () => ({
  db: {
    slateInstanceConfig: {
      findUnique: mocks.configFindUnique,
      updateMany: mocks.configUpdateMany
    },
    slateVersion: { findUnique: mocks.versionFindUnique }
  }
}));

vi.mock('../../services', () => ({
  slateInvocationService: {
    createInvocation: vi.fn(async () => ({})),
    sendUpdatedConfig: mocks.sendUpdatedConfig
  },
  slateErrorService: { recordSlateError: mocks.recordSlateError }
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), captureMessage: vi.fn() })
}));

await import('./configChanged');

let config = {
  oid: 1n,
  id: 'shic_1',
  tenantOid: 2n,
  value: { region: 'eu' },
  instance: { oid: 3n, slateOid: 4n },
  tenant: { oid: 2n }
};
let invocation = { oid: 5n, id: 'shiv_1' };

let run = (attemptsMade = 0) =>
  mocks.handler!({ newConfigId: config.id, versionId: 'shslv_1' }, { attemptsMade });

describe('slateInstanceConfigChangedQueueProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.configFindUnique.mockResolvedValue(config);
    mocks.versionFindUnique.mockResolvedValue({ oid: 6n, id: 'shslv_1' });
  });

  it('retries a runtime failure without persisting it on the config', async () => {
    mocks.sendUpdatedConfig.mockResolvedValue({
      status: 'error',
      invocation,
      error: {
        code: 'invocation_error',
        message: 'An error occurred during invocation: Unable to invoke function'
      }
    });

    await expect(run()).rejects.toBeInstanceOf(mocks.QueueRetryError);

    expect(mocks.configUpdateMany).not.toHaveBeenCalled();
    expect(mocks.recordSlateError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'config_validation_failed',
        errorCode: 'invocation_error'
      })
    );
  });

  it('records a runtime failure only on the first attempt', async () => {
    mocks.sendUpdatedConfig.mockResolvedValue({
      status: 'error',
      invocation,
      error: { code: 'no_output_message', message: 'Provider did not return a message' }
    });

    await expect(run(3)).rejects.toBeInstanceOf(mocks.QueueRetryError);

    expect(mocks.recordSlateError).not.toHaveBeenCalled();
    expect(mocks.configUpdateMany).not.toHaveBeenCalled();
  });

  it('persists an error the slate itself returned', async () => {
    mocks.sendUpdatedConfig.mockResolvedValue({
      status: 'error',
      invocation,
      error: { code: 'config.region_unsupported', message: 'Region is not supported' }
    });

    await run();

    expect(mocks.configUpdateMany).toHaveBeenCalledWith({
      where: { oid: config.oid },
      data: {
        errorCode: 'config.region_unsupported',
        errorMessage: 'Region is not supported',
        errorInvocationId: invocation.id
      }
    });
    expect(mocks.recordSlateError).toHaveBeenCalledOnce();
  });

  it('persists an invalid config', async () => {
    mocks.sendUpdatedConfig.mockResolvedValue({
      status: 'success',
      invocation,
      data: { success: false, errors: [{ message: 'region is required' }] }
    });

    await run();

    expect(mocks.configUpdateMany).toHaveBeenCalledWith({
      where: { oid: config.oid },
      data: {
        errorCode: 'invalid_config',
        errorMessage: 'The provided configuration is invalid - region is required',
        errorInvocationId: invocation.id
      }
    });
  });

  it('clears the error and stores the normalized config on success', async () => {
    mocks.sendUpdatedConfig.mockResolvedValue({
      status: 'success',
      invocation,
      data: { success: true, config: { region: 'eu-west-1' } }
    });

    await run();

    expect(mocks.configUpdateMany).toHaveBeenCalledWith({
      where: { oid: config.oid },
      data: {
        value: { region: 'eu-west-1' },
        errorCode: null,
        errorMessage: null,
        errorInvocationId: null
      }
    });
    expect(mocks.recordSlateError).not.toHaveBeenCalled();
  });
});
