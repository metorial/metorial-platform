import { expect, it, vi } from 'vitest';

let ensureOrganizationNotificationType = vi.hoisted(() =>
  vi.fn(
    async (
      getter: () => {
        identifier: string;
        name: string;
        severity: string;
        sendEmail: boolean;
      }
    ) => ({ id: getter().identifier })
  )
);

vi.mock('@metorial/db', () => ({
  ensureOrganizationNotificationType
}));

it('upserts the explicit notification type catalog at startup', async () => {
  let { OrganizationNotificationTypes } = await import('./notifications');

  await expect(OrganizationNotificationTypes.organization_notification).resolves.toMatchObject(
    {
      id: 'organization_notification'
    }
  );
  await expect(OrganizationNotificationTypes.billing_alert).resolves.toMatchObject({
    id: 'billing_alert'
  });

  expect(ensureOrganizationNotificationType).toHaveBeenNthCalledWith(1, expect.any(Function));
  expect(ensureOrganizationNotificationType).toHaveBeenNthCalledWith(2, expect.any(Function));

  let definitions = ensureOrganizationNotificationType.mock.calls.map(([getter]) => getter());
  expect(definitions).toEqual([
    {
      identifier: 'organization_notification',
      name: 'Organization Notification',
      severity: 'notification',
      sendEmail: false
    },
    {
      identifier: 'billing_alert',
      name: 'Billing Alert',
      severity: 'alert',
      sendEmail: true
    }
  ]);
});
