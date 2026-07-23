import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    scmRepository: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    scmRepositoryWebhook: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  },
  provider: {
    create: vi.fn(),
    delete: vi.fn(),
    desired: vi.fn(),
    callback: vi.fn(),
    list: vi.fn(),
    read: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('@lowerdeck/id', () => ({ generatePlainId: () => 'secret' }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    process: vi.fn(() => ({ start: vi.fn() }))
  }))
}));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../env', () => ({
  env: {
    service: {
      REDIS_URL: 'redis://localhost',
      ORIGIN_SERVICE_PUBLIC_URL: 'https://origin.example.com'
    }
  }
}));
vi.mock('../../id', () => ({
  ID: { generateId: vi.fn().mockResolvedValue('osw_new') }
}));
vi.mock('../../lib/scmRepositoryWebhook', () => ({
  createProviderRepositoryWebhook: mocks.provider.create,
  deleteProviderRepositoryWebhook: mocks.provider.delete,
  equalRepositoryWebhookEvents: (a: string[], b: string[]) =>
    [...new Set(a)].sort().join(',') === [...new Set(b)].sort().join(','),
  getDesiredRepositoryWebhookEvents: mocks.provider.desired,
  getRepositoryWebhookCallbackUrl: mocks.provider.callback,
  listManagedProviderRepositoryWebhooks: mocks.provider.list,
  readProviderRepositoryWebhook: mocks.provider.read,
  updateProviderRepositoryWebhook: mocks.provider.update
}));

import {
  reconcileRepositoryWebhook,
  shouldBlockRepositoryWebhookReconcile
} from './createRepoWebhook';

let repo = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 1n,
    id: 'osr_repo',
    provider: 'github',
    externalOwner: 'metorial',
    externalName: 'origin',
    externalId: '1',
    webhookReconcileBlockedUntil: null,
    webhookReconcileBlockedReason: null,
    installation: {
      externalInstallationId: '1',
      backend: { type: 'github' }
    },
    ...overrides
  }) as any;

let webhook = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 2n,
    id: 'osw_hook',
    externalId: '10',
    signingSecret: 'secret',
    registeredEvents: ['push'],
    ...overrides
  }) as any;

let state = (overrides: Record<string, unknown> = {}) => ({
  externalId: '10',
  active: true,
  callbackUrl: 'https://origin.example.com/hook',
  registeredEvents: ['push'],
  ...overrides
});

describe('repository webhook single reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.scmRepository.findUnique.mockResolvedValue(repo());
    mocks.db.scmRepositoryWebhook.findUnique.mockResolvedValue(webhook());
    mocks.provider.desired.mockReturnValue(['push']);
    mocks.provider.callback.mockReturnValue('https://origin.example.com/hook');
    mocks.provider.list.mockResolvedValue([]);
    mocks.provider.read.mockResolvedValue(state());
    mocks.provider.update.mockResolvedValue(true);
  });

  it('does not mutate provider or database state when the hook already matches', async () => {
    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.update).not.toHaveBeenCalled();
    expect(mocks.provider.create).not.toHaveBeenCalled();
    expect(mocks.db.scmRepositoryWebhook.update).not.toHaveBeenCalled();
    expect(mocks.db.scmRepository.update).not.toHaveBeenCalled();
  });

  it('updates only a drifted provider hook and persists confirmed events', async () => {
    mocks.db.scmRepositoryWebhook.findUnique.mockResolvedValue(
      webhook({ registeredEvents: [] })
    );
    mocks.provider.read
      .mockResolvedValueOnce(state({ registeredEvents: [] }))
      .mockResolvedValueOnce(state());

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.update).toHaveBeenCalledTimes(1);
    expect(mocks.db.scmRepositoryWebhook.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { externalId: '10', registeredEvents: ['push'] }
    });
  });

  it('refreshes stale stored events without writing to the provider', async () => {
    mocks.db.scmRepositoryWebhook.findUnique.mockResolvedValue(
      webhook({ registeredEvents: [] })
    );

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.update).not.toHaveBeenCalled();
    expect(mocks.db.scmRepositoryWebhook.update).toHaveBeenCalledTimes(1);
  });

  it('recreates a missing remote hook while retaining local identity and secret', async () => {
    mocks.provider.read
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 404 }))
      .mockResolvedValueOnce(state({ externalId: '11' }));
    mocks.provider.create.mockResolvedValue('11');

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'osw_hook', signingSecret: 'secret' })
    );
    expect(mocks.db.scmRepositoryWebhook.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { externalId: '11', registeredEvents: ['push'] }
    });
  });

  it('recreates drifted hooks when a provider adapter cannot update in place', async () => {
    mocks.provider.read
      .mockResolvedValueOnce(state({ registeredEvents: [] }))
      .mockResolvedValueOnce(state({ externalId: '11' }));
    mocks.provider.update.mockResolvedValue(false);
    mocks.provider.create.mockResolvedValue('11');

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.delete).toHaveBeenCalledWith(expect.anything(), '10');
    expect(mocks.provider.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.scmRepositoryWebhook.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { externalId: '11', registeredEvents: ['push'] }
    });
  });

  it('removes only adapter-identified stale managed hooks before initial creation', async () => {
    mocks.db.scmRepositoryWebhook.findUnique.mockResolvedValue(null);
    mocks.provider.list.mockResolvedValue([
      { id: 'stale-one', url: 'https://origin.example.com/hook/stale' }
    ]);
    mocks.provider.create.mockResolvedValue('11');
    mocks.provider.read.mockResolvedValue(state({ externalId: '11' }));

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.provider.delete).toHaveBeenCalledWith(expect.anything(), 'stale-one');
    expect(mocks.db.scmRepositoryWebhook.create).toHaveBeenCalledWith({
      data: {
        id: 'osw_new',
        signingSecret: 'secret',
        repoOid: 1n,
        externalId: '11',
        registeredEvents: ['push'],
        type: 'push'
      }
    });
  });

  it('blocks permission failures for one week without throwing', async () => {
    mocks.provider.read.mockRejectedValue(
      Object.assign(new Error('Resource not accessible by integration'), { status: 403 })
    );

    await expect(reconcileRepositoryWebhook('osr_repo')).resolves.toBeUndefined();

    expect(mocks.db.scmRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        webhookReconcileBlockedUntil: expect.any(Date),
        webhookReconcileBlockedReason: expect.stringContaining('permission_denied')
      }
    });
    let blockedUntil =
      mocks.db.scmRepository.update.mock.calls[0]![0].data.webhookReconcileBlockedUntil;
    expect(blockedUntil.getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60_000);
  });

  it('skips repositories whose reconciliation block has not expired', async () => {
    mocks.db.scmRepository.findUnique.mockResolvedValue(
      repo({ webhookReconcileBlockedUntil: new Date(Date.now() + 60_000) })
    );

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.db.scmRepositoryWebhook.findUnique).not.toHaveBeenCalled();
    expect(mocks.provider.read).not.toHaveBeenCalled();
  });

  it('keeps transient provider failures retryable', async () => {
    mocks.provider.read.mockRejectedValue(
      Object.assign(new Error('Provider unavailable'), { status: 503 })
    );

    await expect(reconcileRepositoryWebhook('osr_repo')).rejects.toThrow(
      'Provider unavailable'
    );
    expect(mocks.db.scmRepository.update).not.toHaveBeenCalled();
  });

  it('clears an expired block after a successful reconciliation', async () => {
    mocks.db.scmRepository.findUnique.mockResolvedValue(
      repo({
        webhookReconcileBlockedUntil: new Date(Date.now() - 1),
        webhookReconcileBlockedReason: 'permission_denied'
      })
    );

    await reconcileRepositoryWebhook('osr_repo');

    expect(mocks.db.scmRepository.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        webhookReconcileBlockedUntil: null,
        webhookReconcileBlockedReason: null
      }
    });
  });

  it('does not treat duplicate conflicts as week-long blocks', () => {
    expect(
      shouldBlockRepositoryWebhookReconcile(
        Object.assign(new Error('Hook already exists'), { status: 422 })
      )
    ).toBe(false);
  });
});
