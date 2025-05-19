import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerRunErrorGroup } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerErrorsTable } from '../../../scenes/server-errors/errorsTable';

export let ServerErrorPage = () => {
  let instance = useCurrentInstance();

  let { serverErrorId } = useParams();
  let error = useServerRunErrorGroup(instance.data?.id, serverErrorId);

  return renderWithLoader({ error })(({ error }) => (
    <ServerErrorsTable serverRunErrorGroupIds={[error.data.id]} />
  ));
};
