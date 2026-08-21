import type { DashboardInstanceCallbacksDestinationsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateCallbackDestination } from '@metorial/state';
import { Button, Dialog, Input, Spacer, showModal } from '@metorial/ui';

let normalizeOptionalString = (value: string | undefined) => value || undefined;

export let showCallbackDestinationFormModal = (p: {
  instanceId: string;
  onCreate?: (
    destination: DashboardInstanceCallbacksDestinationsCreateOutput
  ) => void | Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let createDestination = useCreateCallbackDestination();
    let form = useForm({
      initialValues: {
        name: '',
        description: '',
        url: ''
      },
      onSubmit: async values => {
        let [result] = await createDestination.mutate({
          instanceId: p.instanceId,
          name: values.name.trim(),
          description: normalizeOptionalString(values.description.trim()),
          url: values.url.trim()
        });

        if (!result) return;

        // Attaching to the callback and refreshing happen in the background;
        // failures surface through the mutation's toast.
        close();
        void p.onCreate?.(result);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name'),
          description: yup.string(),
          url: yup.string().trim().url('Enter a valid URL').required('Enter a URL')
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Destination</Dialog.Title>
        <Dialog.Description>
          Destinations are managed at the instance level and can receive callback
          notifications.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Input label="URL" {...form.getFieldProps('url')} />
          <form.RenderError field="url" />

          <Spacer height={20} />

          <Dialog.Actions>
            <Button variant="outline" type="button" onClick={close} size="2">
              Cancel
            </Button>
            <Button
              size="2"
              type="submit"
              loading={createDestination.isLoading}
              success={createDestination.isSuccess}
            >
              Create Destination
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
