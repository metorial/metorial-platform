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

export let consumerAccessRequestApprovedEmail = notificationClient.createTemplate(
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
        subject: `Your access request for ${target.name} was approved`,
        preview: `Access to ${target.name} is now available in ${organization.name}.`,
        content: (
          <Layout
            title={`Your access request was approved`}
            description={`Your request for ${target.name} in ${organization.name} has been approved.`}
          >
            <Text>Hi {consumerAccessRequest.consumerProfile.name},</Text>

            <Text>
              Your access request for <strong>{target.name}</strong> has been approved.
            </Text>

            <DataList
              items={[
                { label: 'Organization', value: organization.name },
                { label: 'Integration', value: target.name }
              ]}
            />

            {!!consumerAccessRequest.resolutionMessage?.trim().length && (
              <Text>
                Resolution message:
                <br />
                {consumerAccessRequest.resolutionMessage}
              </Text>
            )}

            <Button href={url.toString()}>Open Metorial</Button>

            <Text>
              You can now continue in the Metorial app and use the approved resource.
            </Text>
          </Layout>
        )
      });
    }
  })
);
