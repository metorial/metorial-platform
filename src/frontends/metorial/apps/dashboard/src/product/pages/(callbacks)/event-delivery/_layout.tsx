import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDelivery,
  useEventDestination
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiSendPlaneLine } from '@remixicon/react';
import { Link, Outlet, useParams } from 'react-router-dom';
import {
  getEventDeliveryStatusColor,
  getEventDeliveryStatusLabel
} from '../../../scenes/callbacks/shared';

export let EventDeliveryLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDeliveryId } = useParams();
  let delivery = useEventDelivery(organization.data?.id, eventDeliveryId);
  let destination = useEventDestination(
    organization.data?.id,
    delivery.data?.eventDestinationId
  );

  return (
    <DetailsLayout
      entity={
        delivery.data
          ? { ...delivery.data, name: `Delivery ${delivery.data.id}` }
          : delivery.data
      }
      icon={<RiSendPlaneLine />}
      breadcrumbs={[
        {
          label: 'Webhooks',
          to: Paths.instance.eventDestinations(organization.data, project.data, instance.data)
        },
        {
          label: destination.data?.name ?? 'Event Destination',
          to: Paths.instance.eventDestination(
            organization.data,
            project.data,
            instance.data,
            delivery.data?.eventDestinationId
          )
        },
        {
          label: delivery.data?.id,
          to: Paths.instance.eventDelivery(
            organization.data,
            project.data,
            instance.data,
            delivery.data?.id ?? eventDeliveryId
          )
        }
      ]}
      attributes={
        delivery.data
          ? [
              { label: 'Delivery ID', value: <ID id={delivery.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge color={getEventDeliveryStatusColor(delivery.data.status)}>
                    {getEventDeliveryStatusLabel(delivery.data.status)}
                  </Badge>
                )
              },
              {
                label: 'Event',
                value: (
                  <Link
                    to={Paths.instance.event(
                      organization.data,
                      project.data,
                      instance.data,
                      delivery.data.eventId
                    )}
                  >
                    <ID id={delivery.data.eventId} copy={false} />
                  </Link>
                )
              },
              {
                label: 'Destination',
                value: (
                  <Link
                    to={Paths.instance.eventDestination(
                      organization.data,
                      project.data,
                      instance.data,
                      delivery.data.eventDestinationId
                    )}
                  >
                    {destination.data?.name ?? delivery.data.eventDestinationId}
                  </Link>
                )
              },
              { label: 'Attempts', value: `${delivery.data.attemptCount}` },
              {
                label: 'Last Attempt',
                value: delivery.data.lastAttemptAt ? (
                  <RenderDate date={delivery.data.lastAttemptAt} />
                ) : (
                  '-'
                )
              },
              {
                label: 'Created',
                value: <RenderDate date={delivery.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ delivery, destination })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
