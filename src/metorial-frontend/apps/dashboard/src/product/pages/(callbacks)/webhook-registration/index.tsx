import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhooks,
  useWebhookRegistration
} from '@metorial/state';
import { Badge, Button, Callout, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import {
  getIncomingWebhookStatusColor,
  getIncomingWebhookStatusLabel
} from '../../../scenes/callbacks/shared';
import { showWebhookRegistrationSetup } from '../../../scenes/callbacks/webhookRegistrationsTable';

export let WebhookRegistrationOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { webhookRegistrationId } = useParams();
  let registration = useWebhookRegistration(instance.data?.id, webhookRegistrationId);
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
              <Entity.Field title={registration.data.provider.name} />
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
            description="The latest inbound webhooks received by this receiver."
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
