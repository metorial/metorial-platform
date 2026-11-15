import { ensureOrganizationNotificationType } from '@metorial/db';

export let OrganizationNotificationTypes = {
  organization_notification: ensureOrganizationNotificationType(() => ({
    identifier: 'organization_notification',
    name: 'Organization Notification',
    severity: 'notification',
    sendEmail: false
  })),

  billing_alert: ensureOrganizationNotificationType(() => ({
    identifier: 'billing_alert',
    name: 'Billing Alert',
    severity: 'alert',
    sendEmail: true
  }))
};

export type OrganizationNotificationTypeIdentifier =
  keyof typeof OrganizationNotificationTypes;
