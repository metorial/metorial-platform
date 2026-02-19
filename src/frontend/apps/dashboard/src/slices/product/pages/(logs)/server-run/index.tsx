import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderRun } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunEvents } from '../../../scenes/serverRun/events';

export let ServerRunPage = () => {
  let instance = useCurrentInstance();

  let { serverRunId } = useParams();
  let serverRun = useProviderRun(instance.data?.id, serverRunId);

  return renderWithLoader({ serverRun })(({ serverRun }) => (
    <>
      <ServerRunEvents
        serverRun={
          serverRun.data as unknown as Parameters<typeof ServerRunEvents>[0]['serverRun']
        }
      />
    </>
  ));
};
