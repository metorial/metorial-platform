import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SessionPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => <h1>Hello</h1>);
};
