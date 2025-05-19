import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerRun, useServerRunErrors } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let ServerRunPage = () => {
  let instance = useCurrentInstance();

  let { serverRunId } = useParams();
  let run = useServerRun(instance.data?.id, serverRunId);

  let errors = useServerRunErrors(run.data ? instance.data?.id : null, {
    serverRunIds: run.data?.id
  });
  let error = errors.data?.items[0];

  return renderWithLoader({ run })(({ run }) => <h1>Hello</h1>);
};
