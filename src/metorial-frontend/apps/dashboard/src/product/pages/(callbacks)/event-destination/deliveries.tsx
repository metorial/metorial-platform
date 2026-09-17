import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCurrentOrganization, useEventDestination } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { EventDeliveriesTable } from '../../../scenes/callbacks/eventDeliveriesTable';

export let EventDestinationDeliveriesPage = () => {
  let organization = useCurrentOrganization();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);

  return renderWithLoader({ organization, destination })(({ organization, destination }) => (
    <DetailsTableLayout
      title="Deliveries"
      description="Whenever an event matches this destination's listeners, Metorial will attempt to deliver the event to the destination."
    >
      <EventDeliveriesTable
        organizationId={organization.data.id}
        eventDestinationId={destination.data.id}
      />
    </DetailsTableLayout>
  ));
};
