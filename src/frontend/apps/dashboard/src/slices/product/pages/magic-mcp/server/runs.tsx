import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/serverRuns/table';

export let MagicMcpServerRunsPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let deployment = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <ServerRunsTable serverDeploymentId={[deployment.data.serverDeployments[0]?.id]} />
  ));
};
