import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalConsumerProfilesTable } from '../../scenes/portals/usersTable';

export let PortalUsersPage = () => {
  let { portalId } = useParams();

  if (!portalId) return null;

  return (
    <Box title="Users" description="Manage the users who can access this portal.">
      <PortalConsumerProfilesTable portalId={portalId} limit={50} />
    </Box>
  );
};
