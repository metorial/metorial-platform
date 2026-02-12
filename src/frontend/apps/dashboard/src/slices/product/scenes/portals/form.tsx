import { useForm } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';

export let PortalForm = ({ portalId }: { portalId: string }) => {
  let instance = useCurrentInstance();
  let portal = usePortal(instance.data?.instanceId, portalId);
  let update = portal.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: portal.data?.name || '',
      description: portal.data?.description || ''
    },
    onSubmit: async values => {
      let [res] = await update.mutate({
        name: values.name,
        description: values.description
      });

      if (res) {
        close();
      }
    },
    schema: yup =>
      yup.object().shape({
        name: yup.string().required('Name is required'),
        description: yup.string()
      }) as any
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer height={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer height={15} />

      <Button size="2" type="submit" loading={update.isLoading} success={update.isSuccess}>
        Save
      </Button>
    </form>
  );
};
