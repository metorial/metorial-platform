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
          <Layout
            title={`Open ${portal.name}`}
            description={`${invitedBy.name} invited ${consumerProfile.email} to access ${portal.name}. Sign in or create an account to accept the invite and get started.`}
          >
            <Button href={portalUrl}>Open Portal</Button>

            {!!invite.message?.trim().length && (
              <Text>
                {invitedBy.name} sent the following message: <br />
                {invite.message}
              </Text>
            )}

            <Text>
              This invite is currently marked as <strong>{invite.status}</strong>. It will be
              accepted automatically the first time you log in to the portal.
            </Text>
          </Layout>
        )
      });
    }
  })
);
