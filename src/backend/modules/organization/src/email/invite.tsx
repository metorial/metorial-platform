import { getConfig } from '@metorial/config';
import { Organization, OrganizationActor, OrganizationInvite } from '@metorial/db';
import { Button, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendOrgInviteEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      organization,
      invite,
      actor
    }: {
      organization: Organization;
      invite: OrganizationInvite;
      actor: OrganizationActor;
    }) => {
      let url = getConfig().urls.getInviteUrl(invite);

      return createEmail({
        subject: `Join ${organization.name} on Metorial`,
        preview: `${actor.name} has invited you to join ${organization.name} on Metorial.`,
        content: (
          <Layout
            title={`Join ${organization.name} on Metorial`}
            description={`${actor.name} has invited you to join ${organization.name} on Metorial. Click the button below to accept the invitation and get started.`}
          >
            <Button href={url.toString()}>Join {organization.name}</Button>

            {!!invite.message?.trim().length && (
              <Text>
                {actor.name} sent the following message: <br />
                {invite.message}
              </Text>
            )}

            <Text>
              Please don't hesitate to reach out if you have any questions or need help getting
              started.
            </Text>
          </Layout>
        )
      });
    }
  })
);
