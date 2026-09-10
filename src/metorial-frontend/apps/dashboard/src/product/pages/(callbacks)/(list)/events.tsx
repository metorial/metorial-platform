import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentOrganization } from '@metorial/state';
import { EventsTable } from '../../../scenes/callbacks/eventsTable';

export let EventsPage = () => {
  let organization = useCurrentOrganization();

  return renderWithLoader({ organization })(({ organization }) => (
    <EventsTable organizationId={organization.data.id} />
  ));
};
