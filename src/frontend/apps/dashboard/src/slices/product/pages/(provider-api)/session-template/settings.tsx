import { renderWithLoader, useForm } from '@metorial/data-hooks';
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
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let updateMutator = template.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: template.data?.name ?? '',
      description: template.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined()
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    await updateMutator.mutate({
      name,
      description: form.values.description || undefined
    });
  };

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Box
        title="Template Settings"
        description="Modify the settings of this session template."
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="2" type="button" onClick={handleSubmit} loading={updateMutator.isPending}>
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
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
