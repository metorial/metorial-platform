import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderAuthCredential } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderAuthCredentialSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);
  let updateMutator = credential.useUpdateMutator();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Box
        title="Auth Credential Settings"
        description="Modify the settings of this auth credential."
      >
        <Input
          label="Name"
          value={name || credential.data.name || ''}
          onChange={e => setName(e.target.value)}
        />

        <Spacer size={15} />

        <Input
          label="Description"
          value={description || credential.data.description || ''}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            onClick={() =>
              updateMutator.mutate({
                name: name || credential.data.name || undefined,
                description: description || credential.data.description || undefined
              })
            }
            loading={updateMutator.isPending}
          >
            Save
          </Button>
        </div>
      </Box>
    </>
  ));
};
