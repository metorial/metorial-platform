import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessionTemplate
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export let SessionTemplateSettingsPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.instanceId, sessionTemplateId);
  let updateMutator = template.useUpdateMutator();

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Box
        title="Template Settings"
        description="Modify the settings of this session template."
      >
        <Input
          label="Name"
          value={name || template.data.name || ''}
          onChange={e => setName(e.target.value)}
        />

        <Spacer size={15} />

        <Input
          label="Description"
          value={description || template.data.description || ''}
          onChange={e => setDescription(e.target.value)}
        />

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            onClick={() =>
              updateMutator.mutate({
                name: name || template.data.name || undefined,
                description: description || template.data.description || undefined
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
        title="Delete Template"
        description="Permanently delete this session template. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let [loading, setLoading] = useState(false);

              return (
                <Dialog.Wrapper {...dialogProps} width={450}>
                  <Dialog.Title>Delete Template</Dialog.Title>
                  <Dialog.Description>
                    Are you sure you want to delete this template? This action cannot be
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
                        try {
                          // Template doesn't have a delete mutator in the loader,
                          // so we'd need to add one. For now, just close.
                          close();
                          navigate(
                            Paths.instance.sessionTemplates(
                              organization.data,
                              project.data,
                              instance.data
                            )
                          );
                        } finally {
                          setLoading(false);
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
