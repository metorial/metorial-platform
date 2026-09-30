import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    project: { findUniqueOrThrow: vi.fn() },
    consumerActor: { findFirst: vi.fn() },
    consumerIntegration: { findFirst: vi.fn() },
    magicMcpServer: { update: vi.fn() },
    magicMcpEndpoint: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    magicMcpEndpointServer: { findMany: vi.fn(), update: vi.fn() }
  },
  ID: { generateId: vi.fn() }
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    upsertMagicMcpServerBacking: vi.fn(),
    getMagicMcpServerBackingStatuses: vi.fn()
  },
  magicMcpEndpointBackingService: {
    upsertMagicMcpEndpointBacking: vi.fn(),
    getMagicMcpEndpointBackingStatus: vi.fn()
  },
  integrationInstanceService: {}
}));

import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import { healMagicMcpEndpointBacking, healMagicMcpServerBacking } from '../src/lib/backing';

let instance = { oid: 10n, projectOid: 11n } as any;

let server = {
  oid: 20n,
  id: 'magic_server',
  providerTemplateId: 'ptb_1',
  subspaceIntegrationInstanceId: 'iin_1',
  name: 'Slack',
  description: null,
  metadata: {},
  hasSubspaceBacking: true,
  legacySubspaceSessionTemplateId: null,
  subspaceEphemeralManagedSessionId: 'ems_old'
} as any;

let endpoint = {
  oid: 40n,
  id: 'magic_endpoint',
  consumerProfileOid: null,
  name: 'Endpoint',
  description: null,
  metadata: {},
  hasSubspaceBacking: true,
  subspaceEphemeralManagedSessionId: 'ems_endpoint_old',
  servers: [{ id: 'join_1', toolFilters: null, magicMcpServer: server }]
} as any;

let mockServerStatus = (status: string) =>
  vi
    .mocked(magicMcpServerBackingService.getMagicMcpServerBackingStatuses)
    .mockResolvedValue(new Map([[server.id, status]]) as any);

let mockEndpointStatus = (status: string) =>
  vi
    .mocked(magicMcpEndpointBackingService.getMagicMcpEndpointBackingStatus)
    .mockResolvedValue(status as any);

describe('healMagicMcpServerBacking', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
      magicMcpSessionDurationMinutes: 60
    } as any);
    vi.mocked(db.consumerIntegration.findFirst).mockResolvedValue(null);
    vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mockResolvedValue({
      ownerType: 'server_owned',
      ephemeralManagedSession: { id: 'ems_new', isReconciling: false }
    } as any);
    vi.mocked(db.magicMcpServer.update).mockImplementation(
      (async (args: any) => ({ ...server, ...args.data }) as any) as any
    );
  });

  it('leaves healthy backings untouched', async () => {
    mockServerStatus('healthy');

    let result = await healMagicMcpServerBacking({ instance, server });

    expect(result).toBe(server);
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it.each(['stale', 'missing'])('rebuilds %s backings synchronously', async status => {
    mockServerStatus(status);

    let result = await healMagicMcpServerBacking({ instance, server });

    expect(result.subspaceEphemeralManagedSessionId).toBe('ems_new');
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          id: 'magic_server',
          ownerIntegrationInstanceId: 'iin_1',
          deferReconcile: false
        })
      })
    );
  });

  it('reports a reconnect-required error when the integration instance is gone', async () => {
    mockServerStatus('needs_reconnect');

    await expect(healMagicMcpServerBacking({ instance, server })).rejects.toMatchObject({
      data: { code: 'magic_mcp_server_needs_reconnect' }
    });
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('reports a reconnect-required error when a rebuild cannot find the integration instance', async () => {
    mockServerStatus('missing');
    vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mockRejectedValue(
      new ServiceError(notFoundError('integration.instance', 'iin_1'))
    );

    await expect(healMagicMcpServerBacking({ instance, server })).rejects.toMatchObject({
      data: { code: 'magic_mcp_server_needs_reconnect' }
    });
  });

  it('skips servers without a subspace backing or with a legacy template', async () => {
    await healMagicMcpServerBacking({
      instance,
      server: { ...server, hasSubspaceBacking: false }
    });
    await healMagicMcpServerBacking({
      instance,
      server: { ...server, legacySubspaceSessionTemplateId: 'stm_legacy' }
    });

    expect(
      magicMcpServerBackingService.getMagicMcpServerBackingStatuses
    ).not.toHaveBeenCalled();
  });
});

describe('healMagicMcpEndpointBacking', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.project.findUniqueOrThrow).mockResolvedValue({
      magicMcpSessionDurationMinutes: 60
    } as any);
    vi.mocked(db.magicMcpEndpointServer.findMany).mockResolvedValue([]);
    vi.mocked(db.magicMcpEndpoint.findUniqueOrThrow).mockResolvedValue(endpoint);
    vi.mocked(magicMcpServerBackingService.upsertMagicMcpServerBacking).mockResolvedValue({
      ownerType: 'server_owned',
      ephemeralManagedSession: { id: 'ems_new', isReconciling: false }
    } as any);
    vi.mocked(db.magicMcpServer.update).mockImplementation(
      (async (args: any) => ({ ...server, ...args.data }) as any) as any
    );
    vi.mocked(magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking).mockResolvedValue({
      ephemeralManagedSession: { id: 'ems_endpoint_new', isReconciling: false }
    } as any);
    vi.mocked(db.magicMcpEndpoint.update).mockImplementation(
      (async (args: any) => ({ ...endpoint, ...args.data }) as any) as any
    );
  });

  it('leaves healthy endpoints untouched', async () => {
    mockServerStatus('healthy');
    mockEndpointStatus('healthy');

    let result = await healMagicMcpEndpointBacking({ instance, endpoint });

    expect(result).toBe(endpoint);
    expect(
      magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking
    ).not.toHaveBeenCalled();
  });

  it('rebuilds the endpoint when a member server backing is stale', async () => {
    mockServerStatus('stale');
    mockEndpointStatus('healthy');

    let result = await healMagicMcpEndpointBacking({ instance, endpoint });

    expect(result.subspaceEphemeralManagedSessionId).toBe('ems_endpoint_new');
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ id: 'magic_server', deferReconcile: false })
      })
    );
    expect(magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ id: 'magic_endpoint', deferReconcile: false })
      })
    );
  });

  it('rebuilds the endpoint when its own backing is stale', async () => {
    mockServerStatus('healthy');
    mockEndpointStatus('stale');

    let result = await healMagicMcpEndpointBacking({ instance, endpoint });

    expect(result.subspaceEphemeralManagedSessionId).toBe('ems_endpoint_new');
  });

  it('reports a reconnect-required error when a member server lost its integration instance', async () => {
    mockServerStatus('needs_reconnect');
    mockEndpointStatus('healthy');

    await expect(healMagicMcpEndpointBacking({ instance, endpoint })).rejects.toMatchObject({
      data: { code: 'magic_mcp_server_needs_reconnect' }
    });
    expect(
      magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking
    ).not.toHaveBeenCalled();
  });
});
