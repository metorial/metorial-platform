import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useCurrentProject } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';

export let ProjectSettingsPage = () => {
  let project = useCurrentProject();
  let update = project.updateMutator();

  let form = useForm({
    initialValues: {
      name: project.data?.name ?? ''
    },
    updateInitialValues: true,
    onSubmit: async () => {},
    schema: yup =>
      yup.object().shape({
        name: yup.string().required('Name is required')
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
    await update.mutate({ name });
  };

  return renderWithLoader({ project })(({ project }) => (
    <>
      <PageHeader title="Project Settings" description="Update your project settings." />

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={15} />

        <Button type="button" onClick={handleSubmit} loading={update.isLoading} success={update.isSuccess}>
          Save
        </Button>
        <update.RenderError />
      </form>
    </>
  ));
};
