import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDeliveries,
  useEventDestination
} from '@metorial/state';
import { Button, Callout, Entity, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import {
  EventDeliveriesSimpleTable,
  EventDeliveryFailuresList
} from '../../../scenes/callbacks/eventDeliveriesTable';
import { EventDestinationListenersBox } from '../../../scenes/callbacks/listenersBox';

export let EventDestinationPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);
  let failedDeliveries = useEventDeliveries(organization.data?.id, {
    eventDestinationId,
    status: ['failed', 'retrying'],
    limit: 10,
    order: 'desc'
  });
  let recentDeliveries = useEventDeliveries(organization.data?.id, {
    eventDestinationId,
    limit: 10,
    order: 'desc'
  });

  return renderWithLoader({
    destination,
    failedDeliveries,
    recentDeliveries,
    organization,
    project,
    instance
  })(
    ({ destination, failedDeliveries, recentDeliveries, organization, project, instance }) => {
      let deliveriesPath = Paths.instance.eventDestinationDeliveries(
        organization.data,
        project.data,
        instance.data,
        destination.data.id
      );
      let failedParams = new URLSearchParams();
      failedParams.append('status', 'failed');
      failedParams.append('status', 'retrying');

      return (
        <DetailsOverviewLayout>
          {failedDeliveries.data.items.length ? (
            <>
              <Box
                title="Recent Delivery Failures"
                description="The latest webhook deliveries that failed or are being retried."
                rightActions={
                  <Link to={`${deliveriesPath}?${failedParams.toString()}`}>
                    <Button size="2" as="span" variant="outline">
                      View All Deliveries
                    </Button>
                  </Link>
                }
              >
                <Callout color="red">
                  Some webhook deliveries did not complete successfully. Review the failures
                  below for details.
                </Callout>
                <Spacer height={12} />
                <EventDeliveryFailuresList deliveries={failedDeliveries.data.items} />
              </Box>
              <Spacer height={20} />
            </>
          ) : null}

          <Entity.Wrapper header="Endpoint">
            <Entity.Content>
              <Entity.Field
                title="Webhook URL"
                value={destination.data.webhook?.url ?? 'Endpoint unavailable'}
              />

              <Entity.Field title="Method" value="POST" />
            </Entity.Content>
          </Entity.Wrapper>

          <Spacer height={20} />

          <Box
            title="Recent Events"
            description="The latest events sent or scheduled for this destination."
          >
            {recentDeliveries.data.items.length ? (
              <EventDeliveriesSimpleTable
                deliveries={recentDeliveries.data.items}
                listVariant="preview"
                listLimit={10}
                viewAllHref={deliveriesPath}
              />
            ) : (
              <Text size="2" color="gray600">
                No events have been delivered to this endpoint yet.
              </Text>
            )}
          </Box>

          <Spacer height={20} />

          <EventDestinationListenersBox
            organizationId={organization.data.id}
            instanceId={instance.data.id}
            eventDestinationId={destination.data.id}
          />
        </DetailsOverviewLayout>
      );
    }
  );
};
