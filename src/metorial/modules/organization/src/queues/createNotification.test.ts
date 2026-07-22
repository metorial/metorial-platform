import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  notificationFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  destinationFindUnique: vi.fn(),
  destinationCreate: vi.fn(),
  destinationUpdate: vi.fn(),
  destinationAddMany: vi.fn(),
  emailAdd: vi.fn(),
  digestFlushAdd: vi.fn(),
  getSetting: vi.fn(),
  getDigestSetting: vi.fn(),
  nextDigestAt: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationNotification: {
      findUnique: mocks.notificationFindUnique
    },
    organizationMember: {
      findMany: mocks.memberFindMany,
      findFirst: mocks.memberFindFirst
    },
    organizationNotificationDestination: {
      findUnique: mocks.destinationFindUnique,
      create: mocks.destinationCreate,
      update: mocks.destinationUpdate
    }
  },
  ID: { generateId: mocks.generateId }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(({ name }: { name: string }) => ({
    add: vi.fn(),
    addMany: name.endsWith('/destination') ? mocks.destinationAddMany : vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('./sendNotificationEmail', () => ({
  sendOrganizationNotificationEmailQueue: {
    add: mocks.emailAdd
  }
}));

vi.mock('./createNotificationDigest', () => ({
  enqueueOrganizationNotificationDigestFlush: mocks.digestFlushAdd
}));

vi.mock('../lib/notificationSettings', () => ({
  getOrCreateOrganizationNotificationSetting: mocks.getSetting,
  getOrCreateOrganizationNotificationDigestSetting: mocks.getDigestSetting,
  getNextOrganizationNotificationDigestAt: mocks.nextDigestAt
}));

describe('organization notification fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out only to included active members', async () => {
    let { createOrganizationNotificationProcessor } = await import('./createNotification');
    mocks.notificationFindUnique.mockResolvedValue({
      id: 'onf_1',
      organizationOid: 1n,
      onlyForMemberIds: ['ome_2'],
      notForMemberIds: [],
      onlyForMemberRoles: []
    });
    mocks.memberFindMany
      .mockResolvedValueOnce([{ id: 'ome_1' }, { id: 'ome_2' }])
      .mockResolvedValueOnce([]);

    await (createOrganizationNotificationProcessor as any).handler({
      notificationId: 'onf_1'
    });

    expect(mocks.memberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationOid: 1n, status: 'active' }
      })
    );
    expect(mocks.destinationAddMany).toHaveBeenCalledWith([
      { notificationId: 'onf_1', memberId: 'ome_2' }
    ]);
  });

  it('creates destinations and enqueues enabled alert email delivery', async () => {
    let { createOrganizationNotificationDestinationProcessor } =
      await import('./createNotification');
    mocks.notificationFindUnique.mockResolvedValue({
      oid: 3n,
      organizationOid: 1n,
      status: 'active',
      onlyForMemberRoles: ['admin'],
      organization: { oid: 1n, id: 'org_1' },
      type: { oid: 4n, sendEmail: true, severity: 'alert' }
    });
    mocks.memberFindFirst.mockResolvedValue({
      oid: 2n,
      id: 'ome_1',
      userOid: 5n,
      role: 'admin'
    });
    mocks.generateId.mockResolvedValue('ond_1');
    mocks.destinationFindUnique.mockResolvedValue(null);
    mocks.destinationCreate.mockResolvedValue({
      id: 'ond_1',
      emailStatus: 'disabled'
    });
    mocks.destinationUpdate.mockResolvedValue({
      id: 'ond_1',
      emailStatus: 'pending'
    });
    mocks.getSetting.mockResolvedValue({ emailEnabled: true });

    await (createOrganizationNotificationDestinationProcessor as any).handler({
      notificationId: 'onf_1',
      memberId: 'ome_1'
    });

    expect(mocks.destinationCreate).toHaveBeenCalledWith({
      data: {
        id: 'ond_1',
        status: 'active',
        memberOid: 2n,
        notificationOid: 3n
      }
    });
    expect(mocks.destinationUpdate).toHaveBeenCalledWith({
      where: { id: 'ond_1' },
      data: { emailStatus: 'pending' }
    });
    expect(mocks.getSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        member: expect.objectContaining({ id: 'ome_1' }),
        organization: { oid: 1n, id: 'org_1' }
      })
    );
    expect(mocks.emailAdd).toHaveBeenCalledWith({ destinationId: 'ond_1' });
  });

  it('filters member fanout by configured roles', async () => {
    let { createOrganizationNotificationProcessor } = await import('./createNotification');
    mocks.notificationFindUnique.mockResolvedValue({
      id: 'onf_1',
      organizationOid: 1n,
      onlyForMemberIds: [],
      notForMemberIds: [],
      onlyForMemberRoles: ['admin']
    });
    mocks.memberFindMany.mockResolvedValueOnce([]);

    await (createOrganizationNotificationProcessor as any).handler({
      notificationId: 'onf_1'
    });

    expect(mocks.memberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationOid: 1n,
          status: 'active',
          role: { in: ['admin'] }
        }
      })
    );
  });
});
