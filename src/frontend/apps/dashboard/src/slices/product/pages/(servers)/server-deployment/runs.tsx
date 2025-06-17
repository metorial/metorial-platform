import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/serverRuns/table';

export let ServerDeploymentRunsPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <ServerRunsTable serverDeploymentId={[deployment.data.id]} />
  ));
};
