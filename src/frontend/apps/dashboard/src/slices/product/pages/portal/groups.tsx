import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalConsumerGroupsTable } from '../../scenes/portals/groupsTable';

export let PortalGroupsPage = () => {
  let { portalId } = useParams();

  if (!portalId) return null;

  return (
    <Box
      title="Groups"
      description="Consumer groups define which users can access which resources in this portal."
    >
      <PortalConsumerGroupsTable portalId={portalId} limit={50} />
    </Box>
  );
};
