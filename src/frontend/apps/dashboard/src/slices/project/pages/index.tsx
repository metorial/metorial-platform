import { useForm } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentProject } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { useSetLayout } from './_layout';

export let ProjectSettingsPage = () => {
  let project = useCurrentProject();
  let update = project.updateMutator();

  useSetLayout({
    title: 'Project Settings',
    breadcrumbs: [{ label: 'Project Settings', to: '' }]
  });

  let form = useForm({
    initialValues: {
      name: project.data?.name ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({ name: values.name.trim() });
    },
    schema: yup =>
      yup.object().shape({
        name: yup.string().trim().required('Name is required')
      })
  });

  return (
    <ContentLayout variant="medium">
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
    </ContentLayout>
  );
};
