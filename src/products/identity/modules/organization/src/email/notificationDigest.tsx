import { getConfig } from '@metorial/config';
import { Organization, OrganizationNotification } from '@metorial/db';
import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendOrganizationNotificationDigestEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      organization,
      notifications
    }: {
      organization: Organization;
      notifications: OrganizationNotification[];
    }) => {
      let count = notifications.length;
      let subject = `${count} new ${count == 1 ? 'notification' : 'notifications'} for ${organization.name}`;

      return createEmail({
        subject,
        preview: notifications[0]?.message ?? subject,
        content: (
          <Layout
            title="Your Metorial digest"
            description={`Recent updates for ${organization.name}.`}
          >
            {notifications.map(notification => {
              let action = notification.actions[0];
              let actionUrl =
                action?.action.type == 'navigate'
                  ? new URL(action.action.path, getConfig().urls.appUrl).toString()
                  : null;

              return (
                <div key={notification.id} style={{ marginBottom: '1rem' }}>
                  <Text>
                    <strong>{notification.title}</strong>
                    <br />
                    {notification.message}
                  </Text>
                  {!!actionUrl && <Button href={actionUrl}>{action.text}</Button>}
                </div>
              );
            })}
          </Layout>
        )
      });
    }
  })
);
