import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/server-runs/table';

export let ServerDeploymentRunsPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <ServerRunsTable serverDeploymentIds={[deployment.data.id]} />
  ));
};
