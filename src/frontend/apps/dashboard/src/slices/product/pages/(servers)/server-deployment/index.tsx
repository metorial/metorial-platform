import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentForm } from '../../../scenes/server-deployments/form';

export let ServerDeploymentConfigPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <ServerDeploymentForm type="update" serverDeploymentId={deployment.data.id} />
  ));
};
