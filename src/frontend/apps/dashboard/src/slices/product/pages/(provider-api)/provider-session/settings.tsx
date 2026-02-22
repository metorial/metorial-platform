import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useSession
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderSessionSettingsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ session })(({ session }) => (
    <>
      <SideBox title="Session Details" description="View the details of this session.">
        <Input label="Name" value={session.data.name || 'Unnamed Session'} disabled />

        <Spacer size={10} />

        <Input label="Description" value={session.data.description || ''} disabled />

        <Spacer size={10} />

        <Input label="Connection State" value={session.data.connectionState || ''} disabled />
      </SideBox>
    </>
  ));
};
