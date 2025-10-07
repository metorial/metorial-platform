import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerErrorsTable } from '../../../scenes/serverErrors/errorsTable';

export let MagicMcpServerErrorsPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => (
    <ServerErrorsTable serverDeploymentId={[server.data.serverDeployments[0]?.id]} />
  ));
};
