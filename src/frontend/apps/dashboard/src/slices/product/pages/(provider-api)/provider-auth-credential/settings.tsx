import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthCredential
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export let ProviderAuthCredentialSettingsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(
    instance.data?.instanceId,
    providerDeploymentId,
    providerAuthCredentialsId
  );
  let updateMutator = credential.useUpdateMutator();
  let deleteMutator = credential.useDeleteMutator();

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

      <Spacer size={20} />

      <Box
        title="Delete Auth Credential"
        description="Permanently delete this auth credential. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let [loading, setLoading] = useState(false);

              return (
                <Dialog.Wrapper {...dialogProps} width={450}>
                  <Dialog.Title>Delete Auth Credential</Dialog.Title>
                  <Dialog.Description>
                    Are you sure you want to delete this auth credential? This action cannot be
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
                              'auth-configs'
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
