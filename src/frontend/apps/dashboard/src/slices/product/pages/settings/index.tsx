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
    onSubmit: async values => {
      let [res] = await update.mutate(values);
    },
    schema: yup =>
      yup.object().shape({
        name: yup.string().required('Name is required')
      })
  });

  return renderWithLoader({ project })(({ project }) => (
    <>
      <PageHeader title="Project Settings" description="Update your project settings." />

      <form onSubmit={form.handleSubmit}>
        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={15} />

        <Button type="submit" loading={update.isLoading} success={update.isSuccess}>
          Save
        </Button>
        <update.RenderError />
      </form>
    </>
  ));
};
