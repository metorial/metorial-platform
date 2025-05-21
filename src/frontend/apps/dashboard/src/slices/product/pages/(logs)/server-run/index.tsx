import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerRun } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunEvents } from '../../../scenes/serverRun/events';

export let ServerRunPage = () => {
  let instance = useCurrentInstance();

  let { serverRunId } = useParams();
  let serverRun = useServerRun(instance.data?.id, serverRunId);

  return renderWithLoader({ serverRun })(({ serverRun }) => (
    <>
      <ServerRunEvents serverRun={serverRun.data} />
    </>
  ));
};
