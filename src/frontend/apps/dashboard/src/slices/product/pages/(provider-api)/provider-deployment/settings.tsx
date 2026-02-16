import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployment
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export let ProviderDeploymentSettingsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.instanceId, providerDeploymentId);
  let updateMutator = deployment.useUpdateMutator();
  let deleteMutator = deployment.useDeleteMutator();

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

      <Spacer size={20} />

      <Box
        title="Delete Deployment"
        description="Permanently delete this deployment. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let [loading, setLoading] = useState(false);

              return (
                <Dialog.Wrapper {...dialogProps} width={450}>
                  <Dialog.Title>Delete Deployment</Dialog.Title>
                  <Dialog.Description>
                    Are you sure you want to delete this deployment? This action cannot be
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
                              instance.data
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
