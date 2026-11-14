import { getConfig } from '@metorial/config';
import { ApiKey, Organization, OrganizationActor, User } from '@metorial/db';
import {
  Button,
  createEmail,
  createTemplate,
  DataList,
  Layout,
  Text
} from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let apiKeyCreatedEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      organization,
      apiKey,
      user,
      createdBy
    }: {
      organization: Organization;
      apiKey: ApiKey;
      user: User;
      createdBy: OrganizationActor;
    }) => {
      let url = new URL(getConfig().urls.appUrl);

      return createEmail({
        subject: `New API key created for ${organization.name}`,
        preview: `The API key ${apiKey.name} was created in ${organization.name}.`,
        content: (
          <Layout title={`A new API key was created in ${organization.name}`}>
            <Text>
              Hi {user.firstName || user.name},<br />
              <br />
              <strong>{createdBy.name}</strong> created the API key{' '}
              <strong>{apiKey.name}</strong> for <strong>{organization.name}</strong>.
            </Text>

            <DataList
              items={[
                { label: 'API Key Name', value: apiKey.name },
                { label: 'Created By', value: createdBy.name },
                { label: 'Secret', value: apiKey.secretRedacted },
                {
                  label: 'Expires',
                  value: apiKey.expiresAt
                    ? new Date(apiKey.expiresAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })
                    : 'Never'
                },
                {
                  label: 'Type',
                  value: {
                    instance_access_token_publishable: 'Instance Access Token (Publishable)',
                    instance_access_token_secret: 'Instance Access Token (Secret)',
                    organization_management_token: 'Organization Management Token'
                  }[apiKey.type]
                }
              ]}
            />

            <Button href={url.toString()}>Open Metorial</Button>

            <Text>
              If this key was not expected, review your API keys and organization activity in
              the Metorial dashboard.
            </Text>
          </Layout>
        )
      });
    }
  })
);
