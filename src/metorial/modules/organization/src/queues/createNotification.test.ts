import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  notificationFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  destinationUpsert: vi.fn(),
  destinationAddMany: vi.fn(),
  emailAdd: vi.fn(),
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
      upsert: mocks.destinationUpsert
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
      notForMemberIds: []
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

  it('creates destinations idempotently and enqueues configured email delivery', async () => {
    let { createOrganizationNotificationDestinationProcessor } =
      await import('./createNotification');
    mocks.notificationFindUnique.mockResolvedValue({
      oid: 3n,
      organizationOid: 1n,
      status: 'active',
      type: { sendEmail: true }
    });
    mocks.memberFindFirst.mockResolvedValue({ oid: 2n, id: 'ome_1' });
    mocks.generateId.mockResolvedValue('ond_1');
    mocks.destinationUpsert.mockResolvedValue({ id: 'ond_1', emailId: null });

    await (createOrganizationNotificationDestinationProcessor as any).handler({
      notificationId: 'onf_1',
      memberId: 'ome_1'
    });

    expect(mocks.destinationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberOid_notificationOid: {
            memberOid: 2n,
            notificationOid: 3n
          }
        },
        update: {}
      })
    );
    expect(mocks.emailAdd).toHaveBeenCalledWith({ destinationId: 'ond_1' });
  });
});
