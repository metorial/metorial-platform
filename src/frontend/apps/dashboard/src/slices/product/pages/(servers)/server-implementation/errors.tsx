import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerErrorsTable } from '../../../scenes/serverErrors/errorsTable';

export let ServerImplementationErrorsPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <ServerErrorsTable serverImplementationIds={[implementation.data.id]} />
  ));
};
