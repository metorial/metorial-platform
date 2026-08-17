import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  digestSettingUpdate: vi.fn(),
  getDigestSetting: vi.fn(),
  reschedule: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({
      build: () => factory()
    })
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationNotificationDigestSetting: {
      update: mocks.digestSettingUpdate
    },
    organizationNotificationDestination: {
      updateMany: vi.fn()
    }
  },
  withTransaction: async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      user: { update: mocks.userUpdate },
      organizationNotificationDigestSetting: {
        update: mocks.digestSettingUpdate
      }
    })
}));

vi.mock('../definitions/notifications', () => ({
  OrganizationNotificationTypes: {
    organization_notification: Promise.resolve({
      oid: 1n,
      identifier: 'organization_notification'
    }),
    billing_alert: Promise.resolve({ oid: 2n, identifier: 'billing_alert' })
  }
}));

vi.mock('../lib/notificationSettings', () => ({
  getOrCreateOrganizationNotificationDigestSetting: mocks.getDigestSetting,
  getOrCreateOrganizationNotificationSetting: vi.fn()
}));

vi.mock('../queues/createNotificationDigest', () => ({
  rescheduleOrganizationNotificationDigest: mocks.reschedule
}));

describe('notificationSettingService timezone synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({});
  });

  it('stores the browser timezone on the user even when the digest timezone is unchanged', async () => {
    let { notificationSettingService } = await import('./notificationSetting');
    let setting = {
      id: 'onds_1',
      timezone: 'America/Los_Angeles',
      timeMinutes: 480
    };
    mocks.getDigestSetting.mockResolvedValue(setting);

    let result = await notificationSettingService.setNotificationDigestTimezone({
      member: { userOid: 1n } as any,
      organization: { oid: 2n } as any,
      timezone: 'America/Los_Angeles'
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { timezone: 'America/Los_Angeles' }
    });
    expect(mocks.digestSettingUpdate).not.toHaveBeenCalled();
    expect(mocks.reschedule).not.toHaveBeenCalled();
    expect(result).toBe(setting);
  });

  it('updates the user and organization digest schedule together when timezone changes', async () => {
    let { notificationSettingService } = await import('./notificationSetting');
    mocks.getDigestSetting.mockResolvedValue({
      id: 'onds_1',
      timezone: 'America/Los_Angeles',
      timeMinutes: 480
    });
    let updated = {
      id: 'onds_1',
      timezone: 'Europe/Berlin',
      timeMinutes: 480
    };
    mocks.digestSettingUpdate.mockResolvedValue(updated);

    await notificationSettingService.setNotificationDigestTimezone({
      member: { userOid: 1n } as any,
      organization: { oid: 2n } as any,
      timezone: 'Europe/Berlin'
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { timezone: 'Europe/Berlin' }
    });
    expect(mocks.digestSettingUpdate).toHaveBeenCalledWith({
      where: { id: 'onds_1' },
      data: { timezone: 'Europe/Berlin' }
    });
    expect(mocks.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ setting: updated })
    );
  });
});
