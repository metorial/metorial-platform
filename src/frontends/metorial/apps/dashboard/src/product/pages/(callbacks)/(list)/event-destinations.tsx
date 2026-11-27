import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentOrganization } from '@metorial/state';
import { EventDestinationsTable } from '../../../scenes/callbacks/eventDestinationsTable';

export let EventDestinationsPage = () => {
  let organization = useCurrentOrganization();

  return renderWithLoader({ organization })(({ organization }) => (
    <EventDestinationsTable organizationId={organization.data.id} />
  ));
};
