import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestination
} from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let EventDestinationLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);

  return (
    <ContentLayout>
      <PageHeader
        title={destination.data?.name ?? '...'}
        description={
          destination.data?.description ??
          'Metorial delivers the events this destination subscribes to over HTTP.'
        }
        pagination={[
          {
            label: 'Event Destinations',
            href: Paths.instance.eventDestinations(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: destination.data?.name,
            href: Paths.instance.eventDestination(
              organization.data,
              project.data,
              instance.data,
              destination.data?.id ?? eventDestinationId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ destination })(({ destination }) => (
          <>
            <DeletedRecordCallout status={destination.data.status} />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
