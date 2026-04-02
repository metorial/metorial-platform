import { useForm } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';

export let PortalForm = ({ portalId }: { portalId: string }) => {
  let instance = useCurrentInstance();
  let portal = usePortal(instance.data?.id, portalId);
  let updateMutator = portal.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: portal.data?.name || '',
      description: portal.data?.description || ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name,
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={15} />

      <Button size="2" type="submit" loading={updateMutator.isLoading} success={updateMutator.isSuccess}>
        Save
      </Button>
    </form>
  );
};
