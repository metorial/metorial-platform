import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ResourcePortalAccess } from '../../../scenes/portalShare';

export let MagicMcpServerAccessPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ instance, server })(({ instance, server }) => (
    <ResourcePortalAccess
      instanceId={instance.data.id}
      resource={{
        type: 'magic_mcp_server',
        id: server.data.id,
        name: server.data.name ?? server.data.id,
        description: server.data.description
      }}
    />
  ));
};
