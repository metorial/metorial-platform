import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerImplementationForm } from '../../../scenes/server-implementations/form';

export let ServerImplementationConfigPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <ServerImplementationForm type="update" serverImplementationId={implementation.data.id} />
  ));
};
