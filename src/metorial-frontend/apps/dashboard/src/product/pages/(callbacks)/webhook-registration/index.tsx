import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhooks,
  useWebhookRegistration,
  WebhookRegistrationPreview
} from '@metorial/state';
import { Badge, Button, Callout, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';
import { ChatProviderAvatar, useChatProviderListings } from '../../../scenes/chat/shared';
import { showWebhookRegistrationSetup } from '../../../scenes/callbacks/webhookRegistrationsTable';

let openedWebhookRegistrationSetups = new Map<string, true>();

let WebhookRegistrationSetupOnOpen = ({
  instanceId,
  registration,
  onComplete
}: {
  instanceId: string;
  registration: WebhookRegistrationPreview;
  onComplete: () => void;
}) => {
  useEffect(() => {
    if (
      registration.setup.status !== 'pending' ||
      openedWebhookRegistrationSetups.has(registration.id)
    )
      return;

    let timeout = setTimeout(() => {
      openedWebhookRegistrationSetups.set(registration.id, true);
      showWebhookRegistrationSetup({ instanceId, registration, onComplete });
    }, 200);

    return () => clearTimeout(timeout);
  }, [instanceId, onComplete, registration]);

  return null;
};

export let WebhookRegistrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { webhookRegistrationId } = useParams();
  let registration = useWebhookRegistration(instance.data?.id, webhookRegistrationId);
  let providerListings = useChatProviderListings(
    instance.data?.id,
    registration.data ? [registration.data.provider.id] : []
  );
  let incomingWebhooks = useIncomingWebhooks(instance.data?.id, {
    webhookRegistrationId,
    limit: 10,
    order: 'desc'
  });

  return renderWithLoader({ registration, incomingWebhooks })(
    ({ registration, incomingWebhooks }) => {
      let eventsPath = Paths.instance.webhookRegistration(
        organization.data,
        project.data,
        instance.data,
        registration.data.id,
        'events'
      );
      let isPendingSetup = registration.data.setup.status === 'pending';

      return (
        <DetailsOverviewLayout>
          <WebhookRegistrationSetupOnOpen
            instanceId={instance.data!.id}
            registration={registration.data}
            onComplete={() => void registration.refetch()}
          />

          {isPendingSetup ? (
            <>
              <Callout color="orange">
                <span>
                  <strong>Setup is not complete.</strong> Finish the provider instructions to
                  start receiving webhooks at this URL.
                </span>
              </Callout>
              <Spacer height={20} />
            </>
          ) : null}

          <Entity.Wrapper header="Provider">
            <Entity.Content>
              <Entity.Field
                title={
                  providerListings.lookup.get(registration.data.provider.id)?.name ??
                  registration.data.provider.name
                }
                prefix={
                  <ChatProviderAvatar
                    provider={registration.data.provider}
                    listings={providerListings.lookup}
                  />
                }
              />
            </Entity.Content>
          </Entity.Wrapper>

          <Spacer height={20} />

          <Box
            title="Receive URL"
            description="Paste this URL into the provider's webhook settings."
            rightActions={
              isPendingSetup && registration.data.receiveUrl ? (
                <Button
                  size="2"
                  onClick={() =>
                    showWebhookRegistrationSetup({
                      instanceId: instance.data!.id,
                      registration: registration.data,
                      onComplete: () => void registration.refetch()
                    })
                  }
                >
                  Complete Setup
                </Button>
              ) : undefined
            }
          >
            {registration.data.receiveUrl ? (
              <ID id={registration.data.receiveUrl} />
            ) : (
              <Flex align="center" justify="space-between" gap={12}>
                <Text size="2" color="gray600">
                  This receiver does not have a URL yet. Complete setup to provision one.
                </Text>
                <Button
                  size="2"
                  onClick={() =>
                    showWebhookRegistrationSetup({
                      instanceId: instance.data!.id,
                      registration: registration.data,
                      onComplete: () => void registration.refetch()
                    })
                  }
                >
                  Complete Setup
                </Button>
              </Flex>
            )}
          </Box>

          <Spacer height={20} />

          <Box
            title="Recent Events"
            description="The latest inbound webhooks received."
            rightActions={
              incomingWebhooks.data.items.length ? (
                <Link to={eventsPath}>
                  <Button size="2" as="span" variant="outline">
                    View All Events
                  </Button>
                </Link>
              ) : undefined
            }
          >
            {incomingWebhooks.data.items.length ? (
              <Table
                headers={['Status', 'Received', 'ID']}
                data={incomingWebhooks.data.items.slice(0, 10).map(webhook => ({
                  href: Paths.instance.incomingWebhook(
                    organization.data,
                    project.data,
                    instance.data,
                    webhook.id
                  ),
                  data: [
                    <Badge key="status" color={getIncomingWebhookStatusColor(webhook.status)}>
                      {getIncomingWebhookStatusLabel(webhook.status)}
                    </Badge>,
                    <RenderDate key="received" date={webhook.receivedAt} />,
                    <ID key="id" id={webhook.id} />
                  ]
                }))}
              />
            ) : (
              <Text size="2" color="gray600">
                No inbound webhooks have been received on this receiver yet.
              </Text>
            )}
          </Box>
        </DetailsOverviewLayout>
      );
    }
  );
};
