import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentsTable } from '../../../scenes/serverDeployments/table';

export let ServerServerDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  return renderWithLoader({ server })(({ server }) => (
    <ServerDeploymentsTable serverIds={[server.data.id]} />
  ));
};
