import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthConfig
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderAuthConnectionSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(
    instance.data?.id,
    providerDeploymentId,
    providerAuthConfigId
  );
  let updateMutator = authConfig.useUpdateMutator();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ authConfig })(({ authConfig }) => (
    <>
      <Box
        title="Auth Connection Settings"
        description="Modify the settings of this auth connection."
      >
        <Input
          label="Name"
          value={name || authConfig.data.name || ''}
          onChange={e => setName(e.target.value)}
        />

        <Spacer size={15} />

        <Input
          label="Description"
          value={description || authConfig.data.description || ''}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            onClick={() =>
              updateMutator.mutate({
                name: name || authConfig.data.name || undefined,
                description: description || authConfig.data.description || undefined
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
