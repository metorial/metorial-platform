import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createServerError } from '../src/run/data/error';
import type { ServerDeployment, Instance, ServerRun } from '@metorial/db';
import type { EngineSessionError } from '@metorial/mcp-engine-generated';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverRunErrorGroup: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn()
    },
    serverRunError: {
      create: vi.fn()
    },
    serverRun: {
      update: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn(),
    normalizeUUID: vi.fn()
  }
}));

vi.mock('@metorial/hash', () => ({
  Hash: {
    sha256: vi.fn()
  }
}));

const { db, ID } = await import('@metorial/db');
const { Hash } = await import('@metorial/hash');

describe('createServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a server error with a new error group', async () => {
    const mockDeployment = {
      oid: 'deployment-oid',
      serverOid: 'server-oid',
      serverImplementationOid: 'impl-oid'
    } as ServerDeployment;

    const mockInstance = {
      oid: 'instance-oid'
    } as Instance;

    const mockServerRun = {
      oid: 'run-oid',
      engineRunId: 'engine-run-id'
    } as ServerRun;

    const mockError: EngineSessionError = {
      id: 'error-id',
      errorCode: 'failed_to_start',
      errorMessage: 'Server failed to start',
      createdAt: { toNumber: () => Date.now() } as any,
      metadata: { detail: 'some detail' }
    };

    const mockFingerprint = 'fingerprint-hash';
    const mockGroupOid = 'group-oid';
    const mockErrorOid = 'error-oid';
    const mockNormalizedId = 'normalized-error-id';

    vi.mocked(Hash.sha256).mockResolvedValue(mockFingerprint);
    vi.mocked(db.serverRunErrorGroup.findUnique).mockResolvedValue(null);
    vi.mocked(ID.generateId).mockResolvedValue(mockGroupOid);
    vi.mocked(ID.normalizeUUID).mockReturnValue(mockNormalizedId);
    vi.mocked(db.serverRunErrorGroup.upsert).mockResolvedValue({
      oid: mockGroupOid,
      code: 'server_failed_to_start',
      defaultServerRunErrorOid: null
    } as any);
    vi.mocked(db.serverRunError.create).mockResolvedValue({
      oid: mockErrorOid
    } as any);
    vi.mocked(db.serverRun.update).mockResolvedValue({} as any);
    vi.mocked(db.serverRunErrorGroup.updateMany).mockResolvedValue({} as any);

    const result = await createServerError({
      deployment: mockDeployment,
      error: mockError,
      instance: mockInstance,
      serverRun: mockServerRun
    });

    // Verify hash was generated with correct parameters
    expect(Hash.sha256).toHaveBeenCalledWith(
      JSON.stringify(['failed_to_start', 'impl-oid'])
    );

    // Verify error group was created
    expect(db.serverRunErrorGroup.upsert).toHaveBeenCalledWith({
      where: {
        fingerprint_serverOid_instanceOid: {
          fingerprint: mockFingerprint,
          serverOid: 'server-oid',
          instanceOid: 'instance-oid'
        }
      },
      create: expect.objectContaining({
        fingerprint: mockFingerprint,
        message: 'Server failed to start',
        code: 'server_failed_to_start',
        count: 1,
        serverOid: 'server-oid',
        instanceOid: 'instance-oid'
      }),
      update: {
        count: { increment: 1 },
        lastSeenAt: expect.any(Date)
      }
    });

    // Verify error was created
    expect(db.serverRunError.create).toHaveBeenCalled();

    // Verify server run was updated to failed status
    expect(db.serverRun.update).toHaveBeenCalledWith({
      where: { oid: 'run-oid' },
      data: { status: 'failed' }
    });

    expect(result).toEqual({ oid: mockErrorOid });
  });

  it('should use existing error group if found', async () => {
    const mockDeployment = {
      oid: 'deployment-oid',
      serverOid: 'server-oid',
      serverImplementationOid: 'impl-oid'
    } as ServerDeployment;

    const mockInstance = {
      oid: 'instance-oid'
    } as Instance;

    const mockServerRun = {
      oid: 'run-oid',
      engineRunId: 'engine-run-id'
    } as ServerRun;

    const mockError: EngineSessionError = {
      id: 'error-id',
      errorCode: 'execution_error',
      errorMessage: 'Execution failed',
      createdAt: { toNumber: () => Date.now() } as any
    };

    const mockFingerprint = 'fingerprint-hash';
    const existingGroup = {
      oid: 'existing-group-oid',
      code: 'server_exited_error',
      defaultServerRunErrorOid: 'existing-error-oid'
    };

    vi.mocked(Hash.sha256).mockResolvedValue(mockFingerprint);
    vi.mocked(db.serverRunErrorGroup.findUnique).mockResolvedValue(null);
    vi.mocked(db.serverRunErrorGroup.upsert).mockResolvedValue(existingGroup as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-error-id');
    vi.mocked(db.serverRunError.create).mockResolvedValue({ oid: 'new-error-oid' } as any);
    vi.mocked(db.serverRun.update).mockResolvedValue({} as any);
    vi.mocked(db.serverRunErrorGroup.updateMany).mockResolvedValue({} as any);

    await createServerError({
      deployment: mockDeployment,
      error: mockError,
      instance: mockInstance,
      serverRun: mockServerRun
    });

    // Verify that upsert was called to increment count
    expect(db.serverRunErrorGroup.upsert).toHaveBeenCalled();
    // Verify updateMany was not called since group already has default error
    expect(db.serverRunErrorGroup.updateMany).not.toHaveBeenCalled();
  });

  it('should map error codes correctly', async () => {
    const testCases = [
      { code: 'failed_to_start', expected: 'server_failed_to_start' },
      { code: 'failed_to_stop', expected: 'server_failed_to_stop' },
      { code: 'launch_params_error', expected: 'get_launch_params_error' },
      { code: 'execution_error', expected: 'server_exited_error' },
      { code: 'unknown_error', expected: 'unknown_error' }
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();

      const mockDeployment = {
        oid: 'deployment-oid',
        serverOid: 'server-oid',
        serverImplementationOid: 'impl-oid'
      } as ServerDeployment;

      const mockInstance = { oid: 'instance-oid' } as Instance;
      const mockServerRun = { oid: 'run-oid', engineRunId: 'engine-run-id' } as ServerRun;
      const mockError: EngineSessionError = {
        id: 'error-id',
        errorCode: testCase.code,
        errorMessage: 'Test error',
        createdAt: { toNumber: () => Date.now() } as any
      };

      vi.mocked(Hash.sha256).mockResolvedValue('fingerprint');
      vi.mocked(db.serverRunErrorGroup.findUnique).mockResolvedValue(null);
      vi.mocked(ID.generateId).mockResolvedValue('group-id');
      vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
      vi.mocked(db.serverRunErrorGroup.upsert).mockResolvedValue({
        oid: 'group-oid',
        code: testCase.expected,
        defaultServerRunErrorOid: null
      } as any);
      vi.mocked(db.serverRunError.create).mockResolvedValue({ oid: 'error-oid' } as any);
      vi.mocked(db.serverRun.update).mockResolvedValue({} as any);
      vi.mocked(db.serverRunErrorGroup.updateMany).mockResolvedValue({} as any);

      await createServerError({
        deployment: mockDeployment,
        error: mockError,
        instance: mockInstance,
        serverRun: mockServerRun
      });

      const upsertCall = vi.mocked(db.serverRunErrorGroup.upsert).mock.calls[0][0];
      expect(upsertCall.create.code).toBe(testCase.expected);
    }
  });

  it('should handle metadata from both error sources', async () => {
    const mockDeployment = {
      oid: 'deployment-oid',
      serverOid: 'server-oid',
      serverImplementationOid: 'impl-oid'
    } as ServerDeployment;

    const mockInstance = { oid: 'instance-oid' } as Instance;
    const mockServerRun = { oid: 'run-oid', engineRunId: 'engine-run-id' } as ServerRun;

    const mockError: EngineSessionError = {
      id: 'error-id',
      errorCode: 'failed_to_start',
      errorMessage: 'Error with metadata',
      createdAt: { toNumber: () => Date.now() } as any,
      metadata: { key1: 'value1' },
      mcpError: { metadata: { key2: 'value2' } } as any
    };

    vi.mocked(Hash.sha256).mockResolvedValue('fingerprint');
    vi.mocked(db.serverRunErrorGroup.findUnique).mockResolvedValue(null);
    vi.mocked(ID.generateId).mockResolvedValue('group-id');
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
    vi.mocked(db.serverRunErrorGroup.upsert).mockResolvedValue({
      oid: 'group-oid',
      code: 'server_failed_to_start',
      defaultServerRunErrorOid: null
    } as any);
    vi.mocked(db.serverRunError.create).mockResolvedValue({ oid: 'error-oid' } as any);
    vi.mocked(db.serverRun.update).mockResolvedValue({} as any);
    vi.mocked(db.serverRunErrorGroup.updateMany).mockResolvedValue({} as any);

    await createServerError({
      deployment: mockDeployment,
      error: mockError,
      instance: mockInstance,
      serverRun: mockServerRun
    });

    const createCall = vi.mocked(db.serverRunError.create).mock.calls[0][0];
    expect(createCall.data.metadata).toEqual({
      key2: 'value2',
      key1: 'value1'
    });
  });
});
