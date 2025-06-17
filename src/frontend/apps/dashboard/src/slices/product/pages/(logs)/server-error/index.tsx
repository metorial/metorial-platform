import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerRunErrorGroup } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerErrorsTable } from '../../../scenes/serverErrors/errorsTable';

export let ServerErrorPage = () => {
  let instance = useCurrentInstance();

  let { serverErrorId } = useParams();
  let error = useServerRunErrorGroup(instance.data?.id, serverErrorId);

  return renderWithLoader({ error })(({ error }) => (
    <ServerErrorsTable serverRunErrorGroupId={[error.data.id]} />
  ));
};
