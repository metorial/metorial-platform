import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    project: { findUniqueOrThrow: vi.fn() },
    consumerActor: { findFirst: vi.fn() },
    consumerIntegration: { findFirst: vi.fn() },
    magicMcpServer: { update: vi.fn() }
  },
  ID: { generateId: vi.fn() }
}));

vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    upsertMagicMcpServerBacking: vi.fn(),
    getMagicMcpServerBackingStatuses: vi.fn()
  },
  magicMcpEndpointBackingService: {},
  integrationInstanceService: {}
}));

import { db } from '@metorial/db';
import { magicMcpServerBackingService } from '@metorial-subspace/module-integration';
import { healMagicMcpServerBacking } from '../src/lib/backing';

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

let mockStatus = (status: string) =>
  vi
    .mocked(magicMcpServerBackingService.getMagicMcpServerBackingStatuses)
    .mockResolvedValue(new Map([[server.id, status]]) as any);

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
    mockStatus('healthy');

    let result = await healMagicMcpServerBacking({ instance, server });

    expect(result).toBe(server);
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('rebuilds stale backings synchronously', async () => {
    mockStatus('stale');

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
    mockStatus('needs_reconnect');

    await expect(healMagicMcpServerBacking({ instance, server })).rejects.toMatchObject({
      data: { code: 'magic_mcp_server_needs_reconnect' }
    });
    expect(magicMcpServerBackingService.upsertMagicMcpServerBacking).not.toHaveBeenCalled();
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
