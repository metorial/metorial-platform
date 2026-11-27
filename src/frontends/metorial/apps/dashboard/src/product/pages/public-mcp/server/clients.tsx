import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePublicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { PublicMcpClientsTable } from '../../../scenes/publicMcp/clientsTable';

export let PublicMcpServerClientsPage = () => {
  let instance = useCurrentInstance();
  let { publicMcpServerId } = useParams();
  let server = usePublicMcpServer(instance.data?.id, publicMcpServerId);

  return renderWithLoader({ instance, server })(({ instance, server }) => (
    <PublicMcpClientsTable instanceId={instance.data.id} publicMcpServerId={server.data.id} />
  ));
};
