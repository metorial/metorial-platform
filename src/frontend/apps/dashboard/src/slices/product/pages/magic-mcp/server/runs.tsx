import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpServer } from '@metorial/state';
import { Callout } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/serverRuns/table';

export let MagicMcpServerRunsPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(instance.data?.id, magicMcpServerId);

  return renderWithLoader({ server })(({ server }) => {
    let defaultServerDeploymentId = server.data.serverDeployments?.[0]?.id;
    if (!defaultServerDeploymentId) {
      return (
        <Callout color="orange">
          Runs are unavailable for this Subspace-based Magic MCP server.
        </Callout>
      );
    }

    return <ServerRunsTable serverDeploymentId={[defaultServerDeploymentId]} />;
  });
};
