import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList } from '@metorial/data-list';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  IncomingWebhookPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhooks,
  useWebhookRegistration,
  WebhookRegistrationPreview
} from '@metorial/state';
import { Button, Callout, Entity, Flex, Spacer, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { incomingWebhookStatus } from '../../../scenes/callbacks/incomingWebhooksTable';
import { ChatProviderAvatar, useChatProviderListings } from '../../../scenes/chat/shared';
import { showWebhookRegistrationSetup } from '../../../scenes/callbacks/webhookRegistrationsTable';

let RecentIncomingWebhooksList = createDataList<{ webhooks: IncomingWebhookPreview[] }>(
  'webhook-registration-recent-events',
  { customizable: false }
)
  .context(useInstanceContext)
  .items(({ props }) => ({ items: props.webhooks }))
  .columns([
    col.status(incomingWebhookStatus),
    col.date('receivedAt', { id: 'receivedAt', header: 'Received', isDefault: true }),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.incomingWebhook(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

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

          <Box title="Recent Events" description="The latest inbound webhooks received.">
            {incomingWebhooks.data.items.length ? (
              <RecentIncomingWebhooksList
                listVariant="preview"
                listLimit={10}
                viewAllHref={eventsPath}
                webhooks={incomingWebhooks.data.items}
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
