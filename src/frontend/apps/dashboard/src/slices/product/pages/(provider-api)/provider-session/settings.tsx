import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useSession
} from '@metorial/state';
import { Attributes } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { SessionConnectionStatusBadge } from '../../../scenes/sessions/table';

export let ProviderSessionSettingsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <Attributes
      itemWidth="250px"
      attributes={[
        { label: 'Name', content: session.data.name || 'Unnamed Session' },
        { label: 'Description', content: session.data.description || '—' },
        {
          label: 'Connection State',
          content: <SessionConnectionStatusBadge connectionStatus={session.data.connectionState} />
        },
        { label: 'Session ID', content: <ID id={session.data.id} /> }
      ]}
    />
  ));
};
