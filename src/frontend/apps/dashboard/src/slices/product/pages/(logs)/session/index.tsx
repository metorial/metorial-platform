import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { SessionEvents } from '../../../scenes/session/events';

export let SessionPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return <SessionEvents session={session.data} />;
};
