import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let ServerImplementationErrorsPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => <h1>Errors</h1>);
};
