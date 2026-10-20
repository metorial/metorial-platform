import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePublicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PublicMcpGrantsTable } from '../../../scenes/publicMcp/grantsTable';

export let PublicMcpServerAccessPage = () => {
  let instance = useCurrentInstance();
  let { publicMcpServerId } = useParams();
  let server = usePublicMcpServer(instance.data?.id, publicMcpServerId);

  return renderWithLoader({ instance, server })(({ instance, server }) => (
    <PublicMcpGrantsTable instanceId={instance.data.id} publicMcpServerId={server.data.id} />
  ));
};
