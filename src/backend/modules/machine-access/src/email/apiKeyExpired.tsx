import { getConfig } from '@metorial/config';
import { ApiKey, Organization, User } from '@metorial/db';
import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let apiKeyExpiredEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({ organization, apiKey, user }: { organization: Organization; apiKey: ApiKey; user: User }) => {
      let url = new URL(getConfig().urls.appUrl);
      let expiredAt = apiKey.expiresAt?.toUTCString() ?? 'just now';

      return createEmail({
        subject: `API key expired for ${organization.name}`,
        preview: `The API key ${apiKey.name} has expired and may need to be replaced.`,
        content: (
          <Layout
            title={`An API key expired in ${organization.name}`}
            description={`The API key "${apiKey.name}" is now expired. Review your active integrations and replace the key if it is still in use.`}
          >
            <Text>Hi {user.firstName || user.name},</Text>

            <Text>
              The API key <strong>{apiKey.name}</strong> for <strong>{organization.name}</strong>{' '}
              expired on {expiredAt}.
            </Text>

            <Text>
              Key ID: <strong>{apiKey.id}</strong>
              <br />
              Type: <strong>{apiKey.type}</strong>
            </Text>

            <Button href={url.toString()}>Open Metorial</Button>

            <Text>
              If any automation, integration, or environment is still using this key, update it
              with a newly generated API key in the dashboard.
            </Text>
          </Layout>
        )
      });
    }
  })
);
