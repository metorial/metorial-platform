import { Server } from '@metorial/db';
import { createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendRejectEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({ server, rejectReason }: { server: Server; rejectReason: string | null }) => {
      return createEmail({
        subject: `Your server request has been rejected`,
        content: (
          <Layout
            title={`Server Request Rejected`}
            description={`Your server request for access to ${server.name} has been rejected.`}
          >
            <Text>
              Your organization administrator has rejected your server request for access to{' '}
              {server.name}.
            </Text>

            {rejectReason && (
              <Text>
                <strong>Reason for rejection:</strong> {rejectReason}
              </Text>
            )}

            <Text>If you have questions, please contact your organization administrator.</Text>
          </Layout>
        )
      });
    }
  })
);
