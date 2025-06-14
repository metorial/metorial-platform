import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/serverRuns/table';

export let ServerImplementationRunsPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <ServerRunsTable serverImplementationIds={[implementation.data.id]} />
  ));
};
