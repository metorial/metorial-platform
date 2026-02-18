import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { MagicSessionsTable } from '../../../scenes/magicMcp/sessionsTable';

export let MagicMcpServerSessionsPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => (
    <MagicSessionsTable magicMcpServerId={[server.data.id]} />
  ));
};
