import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessionTemplate } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';

export let SessionTemplateSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let updateMutator = template.useUpdateMutator();
  let deleteMutator = template.useDeleteMutator();
  let form = useForm({
    initialValues: {
      name: template.data?.name ?? '',
      description: template.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return renderWithLoader({ template })(({ template }) => (
    <>
      <Box
        title="Template Settings"
        description="Modify the settings of this session template."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={updateMutator.isLoading}
              success={updateMutator.isSuccess}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Delete this session template and remove it from your reusable template library."
        buttonLabel="Delete Template"
        confirmTitle="Delete session template"
        confirmDescription="Are you sure you want to delete this session template?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            Paths.instance.sessionTemplates(
              instance.data?.organization,
              instance.data?.project,
              instance.data
            )
          );
        }}
      />
    </>
  ));
};
