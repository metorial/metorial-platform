import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentsListItems } from '../../../scenes/server-deployments/table';

export let SessionDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <>
      <ServerDeploymentsListItems deployments={session.data?.serverDeployments ?? []} />
    </>
  ));
};
