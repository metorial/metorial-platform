import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getTimezone } from '@lowerdeck/timezone';
import { db, Organization, OrganizationMember, withTransaction } from '@metorial/db';
import {
  OrganizationNotificationTypeIdentifier,
  OrganizationNotificationTypes
} from '../definitions/notifications';
import {
  getOrCreateOrganizationNotificationDigestSetting,
  getOrCreateOrganizationNotificationSetting
} from '../lib/notificationSettings';
import { rescheduleOrganizationNotificationDigest } from '../queues/createNotificationDigest';

let invalidSetting = (message: string) => new ServiceError(badRequestError({ message }));

class OrganizationNotificationSettingService {
  async listNotificationSettings(i: {
    member: OrganizationMember;
    organization: Organization;
  }) {
    let types = await Promise.all(Object.values(OrganizationNotificationTypes));

    return Promise.all(
      types.map(type =>
        getOrCreateOrganizationNotificationSetting({
          member: i.member,
          organization: i.organization,
          type
        })
      )
    );
  }

  async updateNotificationSetting(i: {
    member: OrganizationMember;
    organization: Organization;
    type: OrganizationNotificationTypeIdentifier;
    emailEnabled: boolean;
  }) {
    let typePromise = OrganizationNotificationTypes[i.type];
    if (!typePromise) throw invalidSetting(`Unknown notification type: ${i.type}`);
    let type = await typePromise;

    let setting = await getOrCreateOrganizationNotificationSetting({
      member: i.member,
      organization: i.organization,
      type
    });

    let updated = await db.organizationNotificationSetting.update({
      where: { id: setting.id },
      data: { emailEnabled: i.emailEnabled },
      include: { type: true }
    });

    if (!i.emailEnabled) {
      await db.organizationNotificationDestination.updateMany({
        where: {
          emailStatus: 'pending',
          member: { userOid: i.member.userOid },
          notification: {
            organizationOid: i.organization.oid,
            typeOid: type.oid
          }
        },
        data: {
          emailStatus: 'disabled',
          emailSendAfter: null
        }
      });
    }

    return updated;
  }

  async getNotificationDigestSetting(i: {
    member: OrganizationMember;
    organization: Organization;
  }) {
    return getOrCreateOrganizationNotificationDigestSetting(i);
  }

  async updateNotificationDigestSetting(i: {
    member: OrganizationMember;
    organization: Organization;
    timeMinutes: number;
  }) {
    if (!Number.isInteger(i.timeMinutes) || i.timeMinutes < 0 || i.timeMinutes >= 24 * 60) {
      throw invalidSetting('Digest time must be a whole number of minutes between 0 and 1439');
    }

    let setting = await getOrCreateOrganizationNotificationDigestSetting(i);
    let updated = await db.organizationNotificationDigestSetting.update({
      where: { id: setting.id },
      data: { timeMinutes: i.timeMinutes }
    });

    await rescheduleOrganizationNotificationDigest({
      member: i.member,
      organization: i.organization,
      setting: updated
    });

    return updated;
  }

  async setNotificationDigestTimezone(i: {
    member: OrganizationMember;
    organization: Organization;
    timezone: string;
  }) {
    if (!getTimezone(i.timezone)) {
      throw invalidSetting(`Unknown timezone: ${i.timezone}`);
    }

    let setting = await getOrCreateOrganizationNotificationDigestSetting(i);
    let timezoneChanged = setting.timezone.toLowerCase() != i.timezone.toLowerCase();
    let updated = await withTransaction(async tx => {
      await tx.user.update({
        where: { oid: i.member.userOid },
        data: { timezone: i.timezone }
      });

      if (!timezoneChanged) return setting;

      return tx.organizationNotificationDigestSetting.update({
        where: { id: setting.id },
        data: { timezone: i.timezone }
      });
    });

    if (timezoneChanged) {
      await rescheduleOrganizationNotificationDigest({
        member: i.member,
        organization: i.organization,
        setting: updated
      });
    }

    return updated;
  }
}

export let notificationSettingService = Service.create(
  'organizationNotificationSettingService',
  () => new OrganizationNotificationSettingService()
).build();
