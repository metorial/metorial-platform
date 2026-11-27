import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export type AdminSetupLinkEmailData = {
  senderName: string | null;
  providerName: string;
  organizationName: string;
  setupUrl: string;
  expiresAt: Date;
};

export let adminSetupLinkEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      senderName,
      providerName,
      organizationName,
      setupUrl,
      expiresAt
    }: AdminSetupLinkEmailData) => {
      let requester = senderName
        ? `${senderName} at ${organizationName}`
        : `Someone at ${organizationName}`;

      let expiry = expiresAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
      });

      return createEmail({
        subject: `${requester} asked you to approve ${providerName} for your organization`,
        preview: `${requester} needs an administrator to approve ${providerName} for your organization.`,
        content: (
          <Layout
            title={`Approve ${providerName} for your organization`}
            description={`${requester} asked you to approve ${providerName} for your organization.`}
          >
            <Text>
              As an administrator, you can review <strong>{providerName}</strong> and complete
              its setup for your organization. Once you're done, people at{' '}
              <strong>{organizationName}</strong> can connect <strong>{providerName}</strong>{' '}
              on Metorial.
            </Text>

            <Button href={setupUrl}>Review and Approve</Button>

            <Text>
              This link expires on {expiry}. If you weren't expecting this request, you can
              safely ignore this email.
            </Text>
          </Layout>
        )
      });
    }
  })
);
