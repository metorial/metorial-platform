import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionFindFirst: vi.fn(),
  configUpdateMany: vi.fn(async () => ({ count: 1 })),
  configChangedAdd: vi.fn(async () => ({}))
}));

vi.mock('@mtsrc/slates-hub-db/db', () => ({
  db: {
    slateSession: { findFirst: mocks.sessionFindFirst, updateMany: vi.fn() },
    slateInstanceConfig: { updateMany: mocks.configUpdateMany }
  }
}));

vi.mock('@mtsrc/slates-hub-db/id', () => ({ getId: () => ({ oid: 1n, id: 'test' }) }));

vi.mock('@mtsrc/slates-hub-module-instances/configChanged', () => ({
  slateInstanceConfigChangedQueue: { add: mocks.configChangedAdd }
}));

vi.mock('@mtsrc/slates-hub-storage/storage', () => ({
  storage: {},
  invocationsBucketRecord: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-module-invocations/attachmentSignature', () => ({
  signedIntegrationAttachmentUrl: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-module-invocations/attachmentEgress', () => ({
  attachmentEgressFor: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-module-invocations/attachmentUpload', () => ({
  claimAttachmentUpload: vi.fn(),
  confirmAttachmentUpload: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-module-invocations/store', () => ({
  getStoredAttachmentsStorageKey: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-protocol/secretSerializer', () => ({
  containsSecretPlaceholder: vi.fn()
}));
vi.mock('@mtsrc/slates-hub-module-errors/slateError', () => ({
  slateErrorService: { recordSlateError: vi.fn() }
}));
vi.mock('@mtsrc/slates-hub-module-instances/slateInstanceAuthHandler', () => ({
  slateAuthHandlerService: {}
}));
vi.mock('@mtsrc/slates-hub-module-invocations/slateInvocation', () => ({
  slateInvocationService: {}
}));
vi.mock('./slateSession', () => ({ slateSessionService: {} }));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), captureMessage: vi.fn() })
}));

let { slateSessionToolCallService } = await import('./slateSessionToolCall');

let sessionWithConfig = (config: {
  errorCode: string | null;
  errorMessage: string | null;
}) => ({
  oid: 1n,
  id: 'shses_1',
  createdAt: new Date(),
  lastActiveAt: null,
  slate: { oid: 2n, currentVersionOid: 3n },
  slateInstance: { oid: 4n, currentConfig: { oid: 5n, id: 'shic_1', value: {}, ...config } },
  slateVersion: { oid: 3n, id: 'shslv_1', status: 'inactive', specification: null },
  instanceConfiguration: null,
  tenant: { oid: 6n }
});

let createCall = () =>
  slateSessionToolCallService.createSlateToolCall({
    input: {
      tenantId: 'tenant',
      sessionId: 'shses_1',
      toolId: 'list_repos',
      input: {},
      participants: []
    }
  });

describe('createSlateToolCall with a stored config error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects the call when the slate rejected the config', async () => {
    mocks.sessionFindFirst.mockResolvedValue(
      sessionWithConfig({
        errorCode: 'invalid_config',
        errorMessage: 'The provided configuration is invalid - region is required'
      })
    );

    await expect(createCall()).rejects.toThrow(
      'Provider instance configuration has an error: The provided configuration is invalid - region is required'
    );

    expect(mocks.configUpdateMany).not.toHaveBeenCalled();
    expect(mocks.configChangedAdd).not.toHaveBeenCalled();
  });

  it('clears a stored runtime failure, re-validates and lets the call through', async () => {
    mocks.sessionFindFirst.mockResolvedValue(
      sessionWithConfig({
        errorCode: 'invocation_error',
        errorMessage: 'An error occurred during invocation: Unable to invoke function'
      })
    );

    // The test session's version is inactive, so passing the config gate ends at that check.
    await expect(createCall()).rejects.toThrow('Provider is not active');

    expect(mocks.configUpdateMany).toHaveBeenCalledWith({
      where: { oid: 5n, errorCode: 'invocation_error' },
      data: { errorCode: null, errorMessage: null, errorInvocationId: null }
    });
    expect(mocks.configChangedAdd).toHaveBeenCalledWith({
      newConfigId: 'shic_1',
      versionId: 'shslv_1'
    });
  });

  it('does not re-enqueue validation when a concurrent call already cleared the error', async () => {
    mocks.sessionFindFirst.mockResolvedValue(
      sessionWithConfig({ errorCode: 'invocation_error', errorMessage: null })
    );
    mocks.configUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(createCall()).rejects.toThrow('Provider is not active');

    expect(mocks.configChangedAdd).not.toHaveBeenCalled();
  });
});
