import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  generateId: vi.fn(),
  enqueue: vi.fn(),
  type: Promise.resolve({ oid: 10n, identifier: 'organization_notification' })
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: () => factory()
    })
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (callback: () => Promise<void>) => await callback(),
  db: {
    organizationNotificationDestination: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany
    }
  },
  ID: { generateId: mocks.generateId },
  withTransaction: async (callback: (db: unknown) => Promise<unknown>) =>
    await callback({
      organizationNotification: {
        create: mocks.create
      }
    })
}));

vi.mock('../definitions/notifications', () => ({
  OrganizationNotificationTypes: {
    organization_notification: mocks.type,
    billing_alert: Promise.resolve({ oid: 11n, identifier: 'billing_alert' })
  }
}));

vi.mock('../queues/createNotification', () => ({
  createOrganizationNotificationQueue: {
    add: mocks.enqueue
  }
}));

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateId.mockResolvedValue('onf_1');
    mocks.create.mockResolvedValue({ id: 'onf_1' });
  });

  it('resolves the persisted type and enqueues fanout after creation', async () => {
    let { notificationService } = await import('./notification');

    await notificationService.createNotification({
      organization: { oid: 1n } as any,
      type: 'organization_notification',
      input: {
        kind: 'organization.created',
        title: 'Welcome',
        message: 'Welcome to Metorial'
      }
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'onf_1',
        organizationOid: 1n,
        typeOid: 10n,
        onlyForMemberIds: [],
        notForMemberIds: [],
        onlyForMemberRoles: []
      }),
      include: { type: true }
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({ notificationId: 'onf_1' });
  });

  it('persists an explicit suppressEmail flag', async () => {
    let { notificationService } = await import('./notification');

    await notificationService.createNotification({
      organization: { oid: 1n } as any,
      type: 'billing_alert',
      suppressEmail: true,
      input: {
        kind: 'subscription.usage.alert',
        title: 'Subscription Usage Alert',
        message: 'You have reached 100% of your included usage'
      }
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ suppressEmail: true }),
      include: { type: true }
    });
  });

  it('rejects mark-read requests containing an inaccessible notification', async () => {
    let { notificationService } = await import('./notification');
    mocks.findMany.mockResolvedValue([]);

    await expect(
      notificationService.markNotificationRead({
        member: { oid: 2n } as any,
        notificationIds: ['onf_missing']
      })
    ).rejects.toThrow();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
