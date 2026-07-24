import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  settingUpsert: vi.fn(),
  digestSettingUpsert: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationNotificationSetting: {
      upsert: mocks.settingUpsert
    },
    organizationNotificationDigestSetting: {
      upsert: mocks.digestSettingUpsert
    }
  },
  ID: { generateId: mocks.generateId }
}));

import {
  getNextOrganizationNotificationDigestAt,
  getOrCreateOrganizationNotificationDigestSetting,
  getOrCreateOrganizationNotificationSetting
} from './notificationSettings';

describe('organization notification setting defaults', () => {
  it('copies the notification type email default on lazy creation', async () => {
    mocks.generateId.mockResolvedValueOnce('ons_1');
    mocks.settingUpsert.mockResolvedValueOnce({});

    await getOrCreateOrganizationNotificationSetting({
      member: { userOid: 1n } as any,
      organization: { oid: 2n } as any,
      type: { oid: 3n, sendEmail: true } as any
    });

    expect(mocks.settingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userOid_organizationOid_typeOid: {
            userOid: 1n,
            organizationOid: 2n,
            typeOid: 3n
          }
        },
        create: expect.objectContaining({
          id: 'ons_1',
          emailEnabled: true
        }),
        update: {}
      })
    );
  });

  it('lazily creates one global digest schedule per user and organization', async () => {
    mocks.generateId.mockResolvedValueOnce('onds_1');
    mocks.digestSettingUpsert.mockResolvedValueOnce({});

    await getOrCreateOrganizationNotificationDigestSetting({
      member: { userOid: 1n } as any,
      organization: { oid: 2n } as any
    });

    expect(mocks.digestSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userOid_organizationOid: {
            userOid: 1n,
            organizationOid: 2n
          }
        },
        create: expect.objectContaining({
          id: 'onds_1',
          timeMinutes: 480,
          timezone: 'America/Los_Angeles'
        }),
        update: {}
      })
    );
  });
});

describe('organization notification digest scheduling', () => {
  it('schedules 08:00 Pacific using the winter UTC offset', () => {
    let result = getNextOrganizationNotificationDigestAt({
      now: new Date('2026-01-15T15:00:00.000Z'),
      timeMinutes: 8 * 60,
      timezone: 'America/Los_Angeles'
    });

    expect(result.toISOString()).toBe('2026-01-15T16:00:00.000Z');
  });

  it('schedules 08:00 Pacific using the summer UTC offset', () => {
    let result = getNextOrganizationNotificationDigestAt({
      now: new Date('2026-07-15T14:00:00.000Z'),
      timeMinutes: 8 * 60,
      timezone: 'America/Los_Angeles'
    });

    expect(result.toISOString()).toBe('2026-07-15T15:00:00.000Z');
  });

  it('schedules the next day after the local digest time has passed', () => {
    let result = getNextOrganizationNotificationDigestAt({
      now: new Date('2026-07-15T16:00:00.000Z'),
      timeMinutes: 8 * 60,
      timezone: 'America/Los_Angeles'
    });

    expect(result.toISOString()).toBe('2026-07-16T15:00:00.000Z');
  });
});
