import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerErrorsTable } from '../../../scenes/serverErrors/errorsTable';

export let ServerDeploymentErrorsPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <ServerErrorsTable serverDeploymentIds={[deployment.data.id]} />
  ));
};
