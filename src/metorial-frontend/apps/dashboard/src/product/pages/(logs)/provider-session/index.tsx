import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams, useSearchParams } from 'react-router-dom';
import { SessionTracingScene } from '../../../scenes/sessionTracing';

export let ProviderSessionLogsPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let [searchParams] = useSearchParams();
  let session = useSession(instance.data?.id, sessionId);
  let initialConnectionId = searchParams.get('connection_id');
  let focusedItemId = searchParams.get('message_id') ?? null;

  return renderWithLoader({ session })(({ session }) => (
    <SessionTracingScene
      session={session.data}
      initialConnectionId={initialConnectionId}
      focusedItemId={focusedItemId}
    />
  ));
};

export let ProviderSessionLogs = SessionTracingScene;
