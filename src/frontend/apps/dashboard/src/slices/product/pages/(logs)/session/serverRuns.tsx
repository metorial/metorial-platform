import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ServerRunsTable } from '../../../scenes/server-runs/table';

export let SessionServerRunsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <>
      <ServerRunsTable sessionIds={[session.data.id]} />
    </>
  ));
};
