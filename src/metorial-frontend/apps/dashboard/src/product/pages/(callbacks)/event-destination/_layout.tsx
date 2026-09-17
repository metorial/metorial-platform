import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestination
} from '@metorial/state';
import { Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiWebhookLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { getStatusColor } from '../../../scenes/callbacks/shared';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let EventDestinationLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);

  let destinationPath = (...subPages: string[]) =>
    Paths.instance.eventDestination(
      organization.data,
      project.data,
      instance.data,
      destination.data?.id ?? eventDestinationId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={destination.data}
      icon={<RiWebhookLine />}
      breadcrumbs={[
        {
          label: 'Webhooks',
          to: Paths.instance.eventDestinations(organization.data, project.data, instance.data)
        },
        {
          label: destination.data?.name,
          to: destinationPath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: destinationPath() },
        { label: 'Deliveries', to: destinationPath('deliveries') },
        { label: 'Settings', to: destinationPath('settings') }
      ]}
      attributes={
        destination.data
          ? [
              { label: 'ID', value: <ID id={destination.data.id} /> },
              {
                label: 'Status',
                value: (
                  <Badge size="1" color={getStatusColor(destination.data.status)}>
                    {destination.data.status}
                  </Badge>
                )
              },
              {
                label: 'Endpoint',
                value: destination.data.webhook?.url ?? 'Endpoint unavailable'
              },
              {
                label: 'Method',
                value: destination.data.webhook?.method ?? 'POST'
              },
              {
                label: 'Listeners',
                value: `${destination.data.listeners.length}`
              },
              {
                label: 'Created',
                value: <RenderDate date={destination.data.createdAt} />
              }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ destination })(({ destination }) => (
          <>
            <DeletedRecordCallout status={destination.data.status} />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
