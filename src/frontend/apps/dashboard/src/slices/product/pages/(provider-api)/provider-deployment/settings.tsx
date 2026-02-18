import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderDeployment
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderDeploymentSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let updateMutator = deployment.useUpdateMutator();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <Box title="Deployment Settings" description="Modify the settings of this deployment.">
        <Input
          label="Name"
          value={name || deployment.data.name || ''}
          onChange={e => setName(e.target.value)}
        />

        <Spacer size={15} />

        <Input
          label="Description"
          value={description || deployment.data.description || ''}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            onClick={() =>
              updateMutator.mutate({
                name: name || deployment.data.name || undefined,
                description: description || deployment.data.description || undefined
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
