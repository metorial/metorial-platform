import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderConfig
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderConfigSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerConfigId } = useParams();
  let config = useProviderConfig(
    instance.data?.id,
    providerDeploymentId,
    providerConfigId
  );
  let updateMutator = config.useUpdateMutator();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Box title="Config Settings" description="Modify the settings of this configuration.">
        <Input
          label="Name"
          value={name || config.data.name || ''}
          onChange={e => setName(e.target.value)}
        />

        <Spacer size={15} />

        <Input
          label="Description"
          value={description || config.data.description || ''}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            onClick={() =>
              updateMutator.mutate({
                name: name || config.data.name || undefined,
                description: description || config.data.description || undefined
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
