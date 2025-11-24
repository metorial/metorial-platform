import { renderWithLoader } from '@metorial/data-hooks';
import { useParams } from 'react-router-dom';
import { MagicMcpServersTable } from '../../../../scenes/magicMcp/serversGrid';
import { useServer } from '../../../../state/consumer/servers';

export let ServerServerDeploymentsPage = () => {
  let { serverId } = useParams();
  let server = useServer(serverId);

  return renderWithLoader({ server })(({ server }) => (
    <MagicMcpServersTable serverId={[server.data.id]} />
  ));
};
