import { getConfig } from '@metorial/config';
import { Organization, OrganizationNotification } from '@metorial/db';
import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendOrganizationNotificationEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      organization,
      notification
    }: {
      organization: Organization;
      notification: OrganizationNotification;
    }) => {
      let action = notification.actions[0];
      let actionUrl =
        action?.action.type == 'navigate'
          ? new URL(action.action.path, getConfig().urls.appUrl).toString()
          : null;

      return createEmail({
        subject: notification.title,
        preview: notification.message,
        content: (
          <Layout title={notification.title} description={notification.message}>
            {!!actionUrl && <Button href={actionUrl}>{action.text}</Button>}
            <Text>
              This notification was sent for your Metorial organization, {organization.name}.
            </Text>
          </Layout>
        )
      });
    }
  })
);
