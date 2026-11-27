import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    integrationProvider: { findMany: vi.fn() },
    integrationInstanceProvider: { findMany: vi.fn() },
    magicMcpServerBacking: { findMany: vi.fn() },
    magicMcpServerProvider: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  getId: vi.fn(() => ({ id: 'mmsp_new' })),
  withTransaction: async (cb: (tx: typeof db) => Promise<unknown>) => await cb(db)
}));

vi.mock('../src/services/magicMcpBacking/shared', () => ({
  getMagicMcpOwnerType: (d: { ownerType: string; ownerIntegrationOid?: bigint | null }) =>
    d.ownerType === 'integration' || d.ownerIntegrationOid ? 'integration' : 'server_owned'
}));

import { syncMagicMcpServerProviderRows } from '../src/lib/magicMcpBacking/serverProviderSync';

let openBacking = {
  oid: 1n,
  ownerType: 'server_owned',
  providerTemplateBackingOid: null,
  ownerIntegrationOid: null,
  integrationOid: 100n,
  integrationInstanceOid: 200n,
  providerTemplateBacking: null,
  integrationInstance: { status: 'active' },
  sessionTemplate: { status: 'active' }
};

let existingRow = (overrides: Record<string, unknown>) => ({
  oid: 50n,
  status: 'active',
  archivedAt: null,
  magicMcpServerBackingOid: 1n,
  integrationProviderOid: 10n,
  integrationInstanceProviderOid: 20n,
  integrationProvider: { status: 'active' },
  ...overrides
});

let mockState = (d: {
  backings?: unknown[];
  integrationProviders?: { oid: bigint; integrationOid: bigint }[];
  instanceProviders?: {
    oid: bigint;
    integrationInstanceOid: bigint;
    integrationProviderOid: bigint;
  }[];
  rows?: unknown[];
}) => {
  db.magicMcpServerBacking.findMany.mockResolvedValue(d.backings ?? [openBacking]);
  db.integrationProvider.findMany.mockResolvedValue(d.integrationProviders ?? []);
  db.integrationInstanceProvider.findMany.mockResolvedValue(d.instanceProviders ?? []);
  db.magicMcpServerProvider.findMany.mockResolvedValue(d.rows ?? []);
};

describe('syncMagicMcpServerProviderRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing without targets', async () => {
    await syncMagicMcpServerProviderRows({});

    expect(db.magicMcpServerBacking.findMany).not.toHaveBeenCalled();
  });

  it('creates pending and active rows for the owner integration providers', async () => {
    mockState({
      integrationProviders: [
        { oid: 10n, integrationOid: 100n },
        { oid: 11n, integrationOid: 100n }
      ],
      instanceProviders: [
        { oid: 20n, integrationInstanceOid: 200n, integrationProviderOid: 10n }
      ]
    });

    await syncMagicMcpServerProviderRows({ magicMcpServerBackingOids: [1n] });

    expect(db.magicMcpServerProvider.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'mmsp_new',
          magicMcpServerBackingOid: 1n,
          integrationProviderOid: 10n,
          integrationInstanceProviderOid: 20n,
          status: 'active'
        },
        {
          id: 'mmsp_new',
          magicMcpServerBackingOid: 1n,
          integrationProviderOid: 11n,
          integrationInstanceProviderOid: null,
          status: 'pending'
        }
      ],
      skipDuplicates: true
    });
    expect(db.magicMcpServerProvider.updateMany).not.toHaveBeenCalled();
  });

  it('leaves rows that already match untouched', async () => {
    mockState({
      integrationProviders: [{ oid: 10n, integrationOid: 100n }],
      instanceProviders: [
        { oid: 20n, integrationInstanceOid: 200n, integrationProviderOid: 10n }
      ],
      rows: [existingRow({})]
    });

    await syncMagicMcpServerProviderRows({ integrationInstanceOids: [200n] });

    expect(db.magicMcpServerProvider.createMany).not.toHaveBeenCalled();
    expect(db.magicMcpServerProvider.updateMany).not.toHaveBeenCalled();
  });

  it('moves a row back to pending when its instance provider goes away', async () => {
    mockState({
      integrationProviders: [{ oid: 10n, integrationOid: 100n }],
      rows: [existingRow({})]
    });

    await syncMagicMcpServerProviderRows({ integrationInstanceOids: [200n] });

    expect(db.magicMcpServerProvider.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [50n] } },
      data: { status: 'pending', integrationInstanceProviderOid: null, archivedAt: undefined }
    });
  });

  it('archives rows whose integration provider is no longer active', async () => {
    mockState({
      rows: [
        existingRow({}),
        existingRow({
          oid: 51n,
          integrationProviderOid: 12n,
          integrationProvider: { status: 'deleted' }
        })
      ]
    });

    await syncMagicMcpServerProviderRows({ integrationOids: [100n] });

    let calls = db.magicMcpServerProvider.updateMany.mock.calls.map(([args]) => args);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          where: { oid: { in: [50n] } },
          data: {
            status: 'archived',
            integrationInstanceProviderOid: 20n,
            archivedAt: expect.any(Date)
          }
        },
        {
          where: { oid: { in: [51n] } },
          data: {
            status: 'deleted',
            integrationInstanceProviderOid: 20n,
            archivedAt: expect.any(Date)
          }
        }
      ])
    );
  });

  it('never revives rows of a backing whose session template is archived', async () => {
    mockState({
      backings: [{ ...openBacking, sessionTemplate: { status: 'archived' } }],
      integrationProviders: [{ oid: 10n, integrationOid: 100n }],
      instanceProviders: [
        { oid: 20n, integrationInstanceOid: 200n, integrationProviderOid: 10n }
      ],
      rows: [existingRow({ status: 'archived', archivedAt: new Date() })]
    });

    await syncMagicMcpServerProviderRows({ integrationOids: [100n] });

    expect(db.magicMcpServerProvider.createMany).not.toHaveBeenCalled();
    expect(db.magicMcpServerProvider.updateMany).not.toHaveBeenCalled();
  });

  it('clears archivedAt when an archived row becomes active again', async () => {
    mockState({
      integrationProviders: [{ oid: 10n, integrationOid: 100n }],
      instanceProviders: [
        { oid: 20n, integrationInstanceOid: 200n, integrationProviderOid: 10n }
      ],
      rows: [existingRow({ status: 'archived', archivedAt: new Date() })]
    });

    await syncMagicMcpServerProviderRows({ integrationOids: [100n] });

    expect(db.magicMcpServerProvider.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [50n] } },
      data: { status: 'active', integrationInstanceProviderOid: 20n, archivedAt: null }
    });
  });

  it('resolves integration provider oids to their integrations', async () => {
    mockState({ backings: [] });
    db.integrationProvider.findMany.mockResolvedValueOnce([{ integrationOid: 100n }]);

    await syncMagicMcpServerProviderRows({ integrationProviderOids: [10n] });

    expect(db.magicMcpServerBacking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { integrationOid: { in: [100n] } },
            { ownerIntegrationOid: { in: [100n] } },
            { providerTemplateBacking: { integrationOid: { in: [100n] } } }
          ]
        }
      })
    );
  });
});
