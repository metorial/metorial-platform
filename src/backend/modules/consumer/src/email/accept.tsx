import { Server } from '@metorial/db';
import { createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendAcceptEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({ server }: { server: Server }) => {
      return createEmail({
        subject: `Your server request has been accepted`,
        content: (
          <Layout
            title={`Server Request Accepted`}
            description={`Your server request for access to ${server.name} has been accepted.`}
          >
            <Text>
              Your organization administrator has accepted your server request for access to{' '}
              {server.name}. You can now visit the Metorial dashboard to set up your server
              deployment.
            </Text>
          </Layout>
        )
      });
    }
  })
);
