import {
  db,
  ID,
  Organization,
  OrganizationMember,
  OrganizationNotificationType
} from '@metorial/db';

export let defaultNotificationDigestTimeMinutes = 8 * 60;
export let defaultNotificationDigestTimezone = 'America/Los_Angeles';

export let getOrCreateOrganizationNotificationSetting = async (i: {
  member: OrganizationMember;
  organization: Organization;
  type: OrganizationNotificationType;
}) =>
  db.organizationNotificationSetting.upsert({
    where: {
      userOid_organizationOid_typeOid: {
        userOid: i.member.userOid,
        organizationOid: i.organization.oid,
        typeOid: i.type.oid
      }
    },
    create: {
      id: await ID.generateId('organizationNotificationSetting'),
      userOid: i.member.userOid,
      organizationOid: i.organization.oid,
      typeOid: i.type.oid,
      emailEnabled: i.type.sendEmail
    },
    update: {},
    include: { type: true }
  });

export let getOrCreateOrganizationNotificationDigestSetting = async (i: {
  member: OrganizationMember;
  organization: Organization;
}) =>
  db.organizationNotificationDigestSetting.upsert({
    where: {
      userOid_organizationOid: {
        userOid: i.member.userOid,
        organizationOid: i.organization.oid
      }
    },
    create: {
      id: await ID.generateId('organizationNotificationDigestSetting'),
      userOid: i.member.userOid,
      organizationOid: i.organization.oid,
      timeMinutes: defaultNotificationDigestTimeMinutes,
      timezone: defaultNotificationDigestTimezone
    },
    update: {}
  });

let getZonedDateParts = (date: Date, timezone: string) => {
  let parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  let values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
};

let zonedDateTimeToUtc = (i: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
}) => {
  let desiredAsUtc = Date.UTC(i.year, i.month - 1, i.day, i.hour, i.minute, 0, 0);
  let result = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 4; attempt++) {
    let actual = getZonedDateParts(result, i.timezone);
    let actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    let adjustment = desiredAsUtc - actualAsUtc;
    if (adjustment == 0) break;
    result = new Date(result.getTime() + adjustment);
  }

  return result;
};

export let getNextOrganizationNotificationDigestAt = (i: {
  now?: Date;
  timeMinutes: number;
  timezone: string;
}) => {
  let now = i.now ?? new Date();
  let localNow = getZonedDateParts(now, i.timezone);
  let hour = Math.floor(i.timeMinutes / 60);
  let minute = i.timeMinutes % 60;
  let localDate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));

  let candidate = zonedDateTimeToUtc({
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth() + 1,
    day: localDate.getUTCDate(),
    hour,
    minute,
    timezone: i.timezone
  });

  if (candidate.getTime() <= now.getTime()) {
    localDate.setUTCDate(localDate.getUTCDate() + 1);
    candidate = zonedDateTimeToUtc({
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate(),
      hour,
      minute,
      timezone: i.timezone
    });
  }

  return candidate;
};
