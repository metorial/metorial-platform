import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { SessionTracingScene } from '../../../scenes/sessionTracing';

export let ProviderSessionLogsPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <SessionTracingScene session={session.data} />
  ));
};

export let ProviderSessionLogs = SessionTracingScene;
