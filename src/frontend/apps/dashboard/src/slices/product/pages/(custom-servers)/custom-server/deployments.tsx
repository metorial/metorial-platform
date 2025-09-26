import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentsTable } from '../../../scenes/serverDeployments/table';

export let CustomServerDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <>
      <ServerDeploymentsTable order="desc" serverId={customServer.data.server.id} />
    </>
  ));
};
