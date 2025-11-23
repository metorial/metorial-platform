import { renderWithLoader } from '@metorial/data-hooks';
import { useParams } from 'react-router-dom';
import { MagicMcpSessionsTable } from '../../../../scenes/magicMcp/sessionsTable';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';

export let MagicMcpServerSessionsPage = () => {
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => (
    <MagicMcpSessionsTable magicMcpServerId={[server.data.id]} />
  ));
};
