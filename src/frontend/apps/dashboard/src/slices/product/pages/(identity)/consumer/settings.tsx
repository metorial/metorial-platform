import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useConsumer, useCurrentInstance } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ConsumerSettingsPage = () => {
  let instance = useCurrentInstance();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);
  let updateMutator = consumer.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: consumer.data?.name ?? '',
      email: consumer.data?.email ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim() || undefined,
        email: values.email.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        email: yup.string().trim().email('Enter a valid email').required('Email is required')
      })
  });

  return renderWithLoader({ consumer })(() => (
    <Box title="Account Settings" description="Update the saved details for this account.">
      <form onSubmit={form.handleSubmit}>
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={15} />

        <Input label="Email" required {...form.getFieldProps('email')} />
        <form.RenderError field="email" />

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
  ));
};
