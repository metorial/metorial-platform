import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export let ProviderSessionSettingsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.instanceId, sessionId);

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ session })(({ session }) => (
    <>
      <SideBox title="Session Details" description="View the details of this session.">
        <Input label="Name" value={session.data.name || 'Unnamed Session'} disabled />

        <Spacer size={10} />

        <Input label="Description" value={session.data.description || ''} disabled />

        <Spacer size={10} />

        <Input label="Status" value={session.data.status || ''} disabled />
      </SideBox>
    </>
  ));
};
