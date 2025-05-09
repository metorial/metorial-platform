import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useUser } from '@metorial/state';
import { Avatar, Button, Input, Spacer } from '@metorial/ui';

export let AccountPage = () => {
  let user = useUser();
  let updateUser = user.updateMutator();

  let userForm = useForm({
    initialValues: {
      name: user.data?.name || ''
    },
    enableReinitialize: true,
    onSubmit: async values => {
      await updateUser.mutate(values);
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Username is required')
      })
  });

  return (
    <>
      <PageHeader title="Account Settings" description="Manage your account." />

      {renderWithLoader({ user })(({ user }) => (
        <>
          <Avatar entity={user.data} size={100} />

          <Spacer size={15} />

          <form onSubmit={userForm.handleSubmit}>
            <Input label="Username" {...userForm.getFieldProps('name')} />
            <userForm.RenderError field="name" />

            <Spacer size={15} />

            <Button
              type="submit"
              loading={updateUser.isLoading}
              success={updateUser.isSuccess}
            >
              Update
            </Button>
          </form>
        </>
      ))}
    </>
  );
};
