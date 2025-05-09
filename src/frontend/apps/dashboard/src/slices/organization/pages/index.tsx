import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useCurrentOrganization } from '@metorial/state';
import { Avatar, Button, Input, Spacer, toast } from '@metorial/ui';

export let OrganizationSettingsPage = () => {
  let organization = useCurrentOrganization();
  let updateOrganization = organization.updateMutator();

  let organizationForm = useForm({
    initialValues: {
      name: organization.data?.name || ''
    },
    enableReinitialize: true,
    onSubmit: async values => {
      if (!values.name) return toast.error('First name is required');

      await updateOrganization.mutate(values);
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required')
      })
  });

  return renderWithLoader({ organization })(({ organization }) => (
    <>
      <PageHeader title="Organization Settings" description="Manage your organization." />

      <Avatar
        entity={{
          name: organization.data.name,
          imageUrl: organization.data.imageUrl
        }}
        size={100}
      />

      <Spacer size={15} />

      <form onSubmit={organizationForm.handleSubmit}>
        <Input label="Name" {...organizationForm.getFieldProps('name')} />
        <organizationForm.RenderError field="name" />

        <Spacer size={15} />

        <Button
          type="submit"
          loading={updateOrganization.isLoading}
          success={updateOrganization.isSuccess}
        >
          Save
        </Button>
      </form>
    </>
  ));
};
