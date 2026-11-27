import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useAllEventDeliveries,
  useAllEventDestinations,
  useCallbackEvent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEvent
} from '@metorial/state';
import { Button, Callout, Entity, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { EventDeliveriesSimpleTable } from '../../../scenes/callbacks/eventDeliveriesTable';
import { decodeWebhookBody } from '../../../scenes/callbacks/shared';
import { SectionList } from '../../../scenes/providerInvocations/styled';

let CallbackEventDetails = ({
  callbackEventId,
  children
}: {
  callbackEventId: string;
  children: React.ReactNode;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let callbackEvent = useCallbackEvent(instance.data?.id, callbackEventId);

  return renderWithLoader({ callbackEvent })(({ callbackEvent }) => {
    let data = callbackEvent.data;
    let isError = data.status === 'failed';
    let webhook = data.details?.webhook ?? null;
    let decodedBody = decodeWebhookBody(webhook?.request?.body);
    let headers = webhook?.request ? Object.entries(webhook.request.headers) : [];

    return (
      <SectionList>
        {isError && data.details?.error ? (
          <Callout color="red">
            <span>
              <strong>{data.details.error.code}</strong> — {data.details.error.message}
            </span>
          </Callout>
        ) : null}

        {children}

        {webhook ? (
          <Entity.Wrapper header="Incoming Webhook">
            <Entity.Content>
              <Entity.Field title="This callback event was received through an incoming webhook." />

              <Entity.Field title="Webhook URL" right>
                <Link
                  to={Paths.instance.incomingWebhook(
                    organization.data,
                    project.data,
                    instance.data,
                    webhook.id
                  )}
                >
                  <Button as="span" size="2" variant="outline">
                    View Incoming Webhook
                  </Button>
                </Link>
              </Entity.Field>
            </Entity.Content>
          </Entity.Wrapper>
        ) : null}
      </SectionList>
    );
  });
};

export let EventPage = () => {
  let { eventId } = useParams();
  let organization = useCurrentOrganization();
  let event = useEvent(organization.data?.id, eventId);
  let deliveries = useAllEventDeliveries(organization.data?.id, {
    eventId,
    order: 'desc'
  });
  let destinations = useAllEventDestinations(organization.data?.id, {
    status: ['active', 'archived']
  });

  return renderWithLoader({ event, deliveries, destinations })(
    ({ event, deliveries, destinations }) => {
      let data = event.data;
      let payload = data.payload ? JSON.stringify(data.payload, null, 2) : null;
      let destinationUrls = new Map(
        destinations.data.map(destination => [
          destination.id,
          destination.webhook?.url ?? 'Endpoint unavailable'
        ])
      );

      return (
        <DetailsOverviewLayout>
          <SectionList>
            <Box title="Webhook Deliveries">
              {deliveries.data.length ? (
                <EventDeliveriesSimpleTable
                  deliveries={deliveries.data}
                  destinationUrls={destinationUrls}
                />
              ) : (
                <Text size="2" color="gray600">
                  No destinations listened to this event, so it was recorded but not delivered
                  anywhere.
                </Text>
              )}
            </Box>

            {data.source === 'callback' && data.callbackEventId ? (
              <CallbackEventDetails callbackEventId={data.callbackEventId}>
                <Box title="Payload" noPadding={!!payload}>
                  {payload ? (
                    <CodeBlock
                      code={payload}
                      language="json"
                      variant="seamless"
                      padding="15px"
                    />
                  ) : (
                    <Text size="2" color="gray600">
                      This event has no payload.
                    </Text>
                  )}
                </Box>
              </CallbackEventDetails>
            ) : (
              <Box title="Payload" noPadding={!!payload}>
                {payload ? (
                  <CodeBlock
                    code={payload}
                    language="json"
                    variant="seamless"
                    padding="15px"
                  />
                ) : (
                  <Text size="2" color="gray600">
                    This event has no payload.
                  </Text>
                )}
              </Box>
            )}
          </SectionList>
        </DetailsOverviewLayout>
      );
    }
  );
};
