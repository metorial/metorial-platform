import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentsListItems } from '../../../scenes/serverDeployments/table';

export let SessionDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.instanceId, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <>
      <ServerDeploymentsListItems deployments={(session.data?.providerDeployments ?? []) as unknown as Parameters<typeof ServerDeploymentsListItems>[0]['deployments']} />
    </>
  ));
};
