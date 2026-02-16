import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfig
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export let ProviderConfigSettingsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { providerDeploymentId, providerConfigId } = useParams();
  let config = useProviderConfig(
    instance.data?.instanceId,
    providerDeploymentId,
    providerConfigId
  );
  let updateMutator = config.useUpdateMutator();
  let deleteMutator = config.useDeleteMutator();

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

      <Spacer size={20} />

      <Box
        title="Delete Config"
        description="Permanently delete this configuration. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let [loading, setLoading] = useState(false);

              return (
                <Dialog.Wrapper {...dialogProps} width={450}>
                  <Dialog.Title>Delete Config</Dialog.Title>
                  <Dialog.Description>
                    Are you sure you want to delete this configuration? This action cannot be
                    undone.
                  </Dialog.Description>

                  <Spacer size={20} />

                  <Dialog.Actions>
                    <Button variant="outline" onClick={close} disabled={loading}>
                      Cancel
                    </Button>
                    <Button
                      color="red"
                      loading={loading}
                      onClick={async () => {
                        setLoading(true);
                        let [, err] = await deleteMutator.mutate({});
                        setLoading(false);
                        if (!err) {
                          close();
                          navigate(
                            Paths.instance.providerDeployments(
                              organization.data,
                              project.data,
                              instance.data,
                              'configs'
                            )
                          );
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Dialog.Actions>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Delete
        </Button>
      </Box>
    </>
  ));
};
