import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEngineRun } from '../src/run/data/engineRun';
import type {
  ServerSession,
  Instance,
  Organization,
  ServerVersion
} from '@metorial/db';
import { EngineRunStatus } from '@metorial/mcp-engine-generated';
import type { EngineSessionRun } from '@metorial/mcp-engine-generated';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    engineRun: {
      create: vi.fn()
    },
    serverRun: {
      create: vi.fn()
    }
  },
  ID: {
    normalizeUUID: vi.fn()
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('../src/run/connection/util', () => ({
  getEngineRunType: vi.fn()
}));

const { db, ID } = await import('@metorial/db');
const { Fabric } = await import('@metorial/fabric');
const { getEngineRunType } = await import('../src/run/connection/util');

describe('createEngineRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an active engine run with hosted server type', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      serverDeploymentOid: 'deployment-oid',
      instanceOid: 'instance-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockVersion: ServerVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      id: 'version-id'
    } as ServerVersion;

    const mockRun: EngineSessionRun = {
      id: 'run-id',
      status: EngineRunStatus.run_status_active,
      sessionId: 'engine-session-id',
      createdAt: { toNumber: () => 1234567890000 } as any
    } as EngineSessionRun;

    const mockEngineRun = {
      oid: 'engine-run-oid',
      id: 'run-id'
    };

    const mockServerRun = {
      oid: 'server-run-oid',
      id: 'normalized-run-id'
    };

    vi.mocked(getEngineRunType).mockReturnValue('container');
    vi.mocked(db.engineRun.create).mockResolvedValue(mockEngineRun as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-run-id');
    vi.mocked(db.serverRun.create).mockResolvedValue(mockServerRun as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);

    const result = await createEngineRun({
      run: mockRun,
      serverSession: mockServerSession,
      version: mockVersion,
      instance: mockInstance
    });

    // Verify engine run was created with correct data
    expect(db.engineRun.create).toHaveBeenCalledWith({
      data: {
        id: 'run-id',
        type: 'container',
        hasEnded: false,
        lastSyncAt: new Date(0),
        createdAt: new Date(1234567890000),
        serverSessionOid: 'session-oid',
        engineSessionId: 'engine-session-id'
      }
    });

    // Verify before event was fired
    expect(Fabric.fire).toHaveBeenCalledWith('server.server_run.created:before', {
      organization: mockInstance.organization,
      instance: mockInstance
    });

    // Verify server run was created with hosted type
    expect(db.serverRun.create).toHaveBeenCalledWith({
      data: {
        id: 'normalized-run-id',
        status: 'active',
        type: 'hosted',
        serverVersionOid: 'version-oid',
        serverDeploymentOid: 'deployment-oid',
        instanceOid: 'instance-oid',
        serverSessionOid: 'session-oid',
        engineRunId: 'run-id'
      }
    });

    // Verify after event was fired
    expect(Fabric.fire).toHaveBeenCalledWith('server.server_run.created:after', {
      serverRun: mockServerRun,
      organization: mockInstance.organization,
      instance: mockInstance
    });

    expect(result).toEqual({
      serverRun: mockServerRun,
      engineRun: mockEngineRun
    });
  });

  it('should create engine run with external server type for remote source', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      serverDeploymentOid: 'deployment-oid',
      instanceOid: 'instance-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockVersion: ServerVersion = {
      oid: 'version-oid',
      sourceType: 'remote',
      id: 'version-id'
    } as ServerVersion;

    const mockRun: EngineSessionRun = {
      id: 'run-id',
      status: EngineRunStatus.run_status_active,
      sessionId: 'engine-session-id',
      createdAt: { toNumber: () => 1234567890000 } as any
    } as EngineSessionRun;

    vi.mocked(getEngineRunType).mockReturnValue('remote');
    vi.mocked(db.engineRun.create).mockResolvedValue({ oid: 'engine-run-oid' } as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-run-id');
    vi.mocked(db.serverRun.create).mockResolvedValue({ oid: 'server-run-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);

    const result = await createEngineRun({
      run: mockRun,
      serverSession: mockServerSession,
      version: mockVersion,
      instance: mockInstance
    });

    // Verify server run was created with external type for remote source
    expect(db.serverRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'external',
        status: 'active'
      })
    });

    expect(result.engineRun).toBeDefined();
    expect(result.serverRun).toBeDefined();
  });

  it('should mark engine run as ended when status is not active', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      serverDeploymentOid: 'deployment-oid',
      instanceOid: 'instance-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockVersion: ServerVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      id: 'version-id'
    } as ServerVersion;

    const mockRun: EngineSessionRun = {
      id: 'run-id',
      status: EngineRunStatus.run_status_ended,
      sessionId: 'engine-session-id',
      createdAt: { toNumber: () => 1234567890000 } as any
    } as EngineSessionRun;

    vi.mocked(getEngineRunType).mockReturnValue('container');
    vi.mocked(db.engineRun.create).mockResolvedValue({ oid: 'engine-run-oid' } as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-run-id');
    vi.mocked(db.serverRun.create).mockResolvedValue({ oid: 'server-run-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);

    await createEngineRun({
      run: mockRun,
      serverSession: mockServerSession,
      version: mockVersion,
      instance: mockInstance
    });

    // Verify engine run was created with hasEnded = true
    expect(db.engineRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hasEnded: true
      })
    });
  });

  it('should handle managed source type', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      serverDeploymentOid: 'deployment-oid',
      instanceOid: 'instance-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockVersion: ServerVersion = {
      oid: 'version-oid',
      sourceType: 'managed',
      id: 'version-id'
    } as ServerVersion;

    const mockRun: EngineSessionRun = {
      id: 'run-id',
      status: EngineRunStatus.run_status_active,
      sessionId: 'engine-session-id',
      createdAt: { toNumber: () => 1234567890000 } as any
    } as EngineSessionRun;

    vi.mocked(getEngineRunType).mockReturnValue('lambda');
    vi.mocked(db.engineRun.create).mockResolvedValue({ oid: 'engine-run-oid' } as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-run-id');
    vi.mocked(db.serverRun.create).mockResolvedValue({ oid: 'server-run-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);

    await createEngineRun({
      run: mockRun,
      serverSession: mockServerSession,
      version: mockVersion,
      instance: mockInstance
    });

    // Verify server run was created with hosted type for managed source
    expect(db.serverRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'hosted'
      })
    });
  });

  it('should use correct timestamp from run createdAt', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      serverDeploymentOid: 'deployment-oid',
      instanceOid: 'instance-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockVersion: ServerVersion = {
      oid: 'version-oid',
      sourceType: 'docker',
      id: 'version-id'
    } as ServerVersion;

    const timestamp = 9876543210000;
    const mockRun: EngineSessionRun = {
      id: 'run-id',
      status: EngineRunStatus.run_status_active,
      sessionId: 'engine-session-id',
      createdAt: { toNumber: () => timestamp } as any
    } as EngineSessionRun;

    vi.mocked(getEngineRunType).mockReturnValue('container');
    vi.mocked(db.engineRun.create).mockResolvedValue({ oid: 'engine-run-oid' } as any);
    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-run-id');
    vi.mocked(db.serverRun.create).mockResolvedValue({ oid: 'server-run-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);

    await createEngineRun({
      run: mockRun,
      serverSession: mockServerSession,
      version: mockVersion,
      instance: mockInstance
    });

    // Verify engine run was created with correct timestamp
    expect(db.engineRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdAt: new Date(timestamp)
      })
    });
  });
});
