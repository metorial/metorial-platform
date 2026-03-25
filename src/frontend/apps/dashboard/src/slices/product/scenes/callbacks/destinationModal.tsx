import type { DashboardInstanceCallbacksDestinationsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { useCreateCallbackDestination } from '@metorial/state';
import { Button, Dialog, Input, Spacer, showModal } from '@metorial/ui';

type DestinationFormValues = {
  name: string;
  description: string;
  url: string;
};

let normalizeOptionalString = (value: string | undefined) => value || undefined;

export let showCallbackDestinationFormModal = (p: {
  instanceId: string;
  onCreate?: (destination: DashboardInstanceCallbacksDestinationsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createDestination = useCreateCallbackDestination();
    let form = useForm<DestinationFormValues>({
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

        p.onCreate?.(result);
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name'),
          description: yup.string().defined(),
          url: yup.string().trim().url('Enter a valid URL').required('Enter a URL')
        })
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
            <Button variant="outline" type="button" onClick={close}>
              Cancel
            </Button>
            <Button
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
