import { ConsumerInvite, ConsumerProfile, OrganizationActor, Portal } from '@metorial/db';
import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendConsumerInviteEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      portal,
      portalUrl,
      invite,
      consumerProfile,
      invitedBy
    }: {
      portal: Portal;
      portalUrl: string;
      invite: ConsumerInvite;
      consumerProfile: ConsumerProfile;
      invitedBy: OrganizationActor;
    }) => {
      return createEmail({
        subject: `You're invited to ${portal.name}`,
        preview: `${invitedBy.name} invited you to access ${portal.name} on Metorial.`,
        content: (
          <Layout title={`Open ${portal.name}`}>
            <Text>Hi {consumerProfile.name},</Text>

            <Text>
              {invitedBy.name} has invited you to join <strong>{portal.name}</strong> on
              Metorial. Metorial lets you connect 1000+ tools and integrations to AI agents.
              Connect coding agents to project management tools, automate CRM workflows, and
              much more. Metorial is managed by your organization administrators.
            </Text>

            <Button href={portalUrl}>Open Metorial</Button>

            {!!invite.message?.trim().length && (
              <Text>
                {invitedBy.name} sent the following message: <br />
                {invite.message}
              </Text>
            )}

            <Text>
              If you have any questions, feel free to reach out to {invitedBy.email}.
            </Text>
          </Layout>
        )
      });
    }
  })
);
