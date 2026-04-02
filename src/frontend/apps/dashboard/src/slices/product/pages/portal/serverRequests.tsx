import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalAccessRequestsTable } from '../../scenes/portals/serverRequests';

export let PortalServerRequestsPage = () => {
  let { portalId } = useParams();

  if (!portalId) return null;

  return (
    <Box
      title="Access Requests"
      description="Review requests for provider templates and Magic MCP servers."
    >
      <PortalAccessRequestsTable portalId={portalId} limit={50} />
    </Box>
  );
};
