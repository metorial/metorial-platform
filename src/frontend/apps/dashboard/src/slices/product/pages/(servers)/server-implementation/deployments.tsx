import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerDeploymentsTable } from '../../../scenes/server-deployments/table';

export let ServerImplementationDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <ServerDeploymentsTable serverServerImplementationIds={[implementation.data.id]} />
  ));
};
