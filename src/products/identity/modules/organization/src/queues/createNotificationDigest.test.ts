import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  digestFindUnique: vi.fn(),
  digestUpdate: vi.fn(),
  destinationUpdateMany: vi.fn(),
  send: vi.fn(),
  getSetting: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn(() => ({ start: vi.fn() }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(() => ({ start: vi.fn() })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationNotificationEmailDigest: {
      findUnique: mocks.digestFindUnique,
      update: mocks.digestUpdate
    },
    organizationNotificationDestination: {
      updateMany: mocks.destinationUpdateMany
    }
  },
  ID: { generateId: vi.fn() },
  withTransaction: async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      organizationNotificationEmailDigest: {
        update: mocks.digestUpdate
      },
      organizationNotificationDestination: {
        updateMany: mocks.destinationUpdateMany
      }
    })
}));

vi.mock('../email/notificationDigest', () => ({
  sendOrganizationNotificationDigestEmail: {
    send: mocks.send
  }
}));

vi.mock('../lib/notificationSettings', () => ({
  getNextOrganizationNotificationDigestAt: vi.fn(),
  getOrCreateOrganizationNotificationSetting: mocks.getSetting
}));

describe('organization notification digest delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends one email for all due destinations and stores the shared email ID', async () => {
    let { sendOrganizationNotificationDigestProcessor } =
      await import('./createNotificationDigest');
    let type = { oid: 3n, severity: 'notification' };
    let notifications = [
      {
        id: 'onf_1',
        typeOid: 3n,
        type,
        title: 'First',
        message: 'First message',
        actions: [],
        onlyForMemberRoles: [],
        validUntil: null
      },
      {
        id: 'onf_2',
        typeOid: 3n,
        type,
        title: 'Second',
        message: 'Second message',
        actions: [],
        onlyForMemberRoles: [],
        validUntil: null
      }
    ];
    mocks.digestFindUnique.mockResolvedValue({
      id: 'oned_1',
      status: 'pending',
      emailId: null,
      organization: { oid: 1n, id: 'org_1', name: 'Acme' },
      member: {
        oid: 2n,
        id: 'ome_1',
        userOid: 4n,
        status: 'active',
        role: 'member',
        actor: { email: 'member@example.com' }
      },
      destinations: notifications.map((notification, index) => ({
        id: `ond_${index + 1}`,
        emailStatus: 'batched',
        notification
      }))
    });
    mocks.getSetting.mockResolvedValue({
      typeOid: 3n,
      emailEnabled: true
    });
    mocks.send.mockResolvedValue({ id: 'eml_1' });

    await (sendOrganizationNotificationDigestProcessor as any).handler({
      digestId: 'oned_1'
    });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({
      to: ['member@example.com'],
      data: {
        organization: expect.objectContaining({ id: 'org_1' }),
        notifications
      }
    });
    expect(mocks.digestUpdate).toHaveBeenCalledWith({
      where: { id: 'oned_1' },
      data: expect.objectContaining({
        status: 'sent',
        emailId: 'eml_1',
        sentAt: expect.any(Date)
      })
    });
    expect(mocks.destinationUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ond_1', 'ond_2'] } },
      data: expect.objectContaining({
        emailStatus: 'sent',
        emailId: 'eml_1',
        emailSentAt: expect.any(Date)
      })
    });
  });

  it('does not resend a completed digest', async () => {
    let { sendOrganizationNotificationDigestProcessor } =
      await import('./createNotificationDigest');
    mocks.digestFindUnique.mockResolvedValue({
      id: 'oned_1',
      status: 'sent',
      emailId: 'eml_1'
    });

    await (sendOrganizationNotificationDigestProcessor as any).handler({
      digestId: 'oned_1'
    });

    expect(mocks.send).not.toHaveBeenCalled();
  });
});
