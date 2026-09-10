import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import {
  EventDestinationsTable,
  showCreateEventDestinationModal
} from '../../../scenes/callbacks/eventDestinationsTable';

export let EventDestinationsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  return renderWithLoader({ organization, project, instance })(
    ({ organization, project, instance }) => (
      <>
        <Text size="2" color="gray600">
          An event destination is an HTTPS endpoint of yours. Metorial signs and POSTs every
          subscribed event to it.
        </Text>

        <Spacer height={16} />

        <Box
          title="Destinations"
          description="Endpoints Metorial delivers events to. Each destination needs at least one subscription before anything is sent."
          rightActions={
            <Button
              size="2"
              onClick={() =>
                showCreateEventDestinationModal({
                  organizationId: organization.data.id,
                  onCreate: created =>
                    navigate(
                      Paths.instance.eventDestination(
                        organization.data,
                        project.data,
                        instance.data,
                        created.id
                      )
                    )
                })
              }
            >
              Create Event Destination
            </Button>
          }
        >
          <EventDestinationsTable organizationId={organization.data.id} />
        </Box>
      </>
    )
  );
};
