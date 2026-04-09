import { getConfig } from '@metorial/config';
import {
  ConsumerAccessRequest,
  ConsumerProfile,
  ConsumerSurface,
  MagicMcpServer,
  Organization,
  ProviderTemplate
} from '@metorial/db';
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

let getAccessRequestTarget = (
  consumerAccessRequest: ConsumerAccessRequest & {
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
  }
) => {
  if (consumerAccessRequest.type == 'provider_template') {
    return {
      name: consumerAccessRequest.providerTemplate?.name ?? 'Provider template'
    };
  }

  return {
    name: consumerAccessRequest.magicMcpServer?.name ?? 'Magic MCP server'
  };
};

export let consumerAccessRequestRejectedEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({
      organization,
      consumerSurface,
      consumerAccessRequest
    }: {
      organization: Organization;
      consumerSurface: ConsumerSurface;
      consumerAccessRequest: ConsumerAccessRequest & {
        consumerProfile: ConsumerProfile;
        providerTemplate: ProviderTemplate | null;
        magicMcpServer: MagicMcpServer | null;
      };
    }) => {
      let url = new URL(getConfig().urls.appUrl);
      let target = getAccessRequestTarget(consumerAccessRequest);

      return createEmail({
        subject: `Your access request for ${target.name} was rejected`,
        preview: `Your request for ${target.name} in ${organization.name} was not approved.`,
        content: (
          <Layout title={`Your access request was rejected`}>
            <Text>Hi {consumerAccessRequest.consumerProfile.name},</Text>

            <Text>
              Your access request for <strong>{target.name}</strong> was reviewed and rejected.
            </Text>

            <DataList
              items={[
                { label: 'Organization', value: organization.name },
                { label: 'Integration', value: target.name },
                ...(consumerAccessRequest.resolutionMessage
                  ? [{ label: 'Message', value: consumerAccessRequest.resolutionMessage }]
                  : [])
              ]}
            />

            <Button href={url.toString()}>Open Metorial</Button>

            <Text>
              You can return to Metorial to review your request details or submit a new request
              if something changes.
            </Text>
          </Layout>
        )
      });
    }
  })
);
