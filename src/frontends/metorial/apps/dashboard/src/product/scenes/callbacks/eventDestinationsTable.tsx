import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { col, createDataList, f, lifecycleStatus } from '@metorial/data-list';
import { useCreateEventDestination, useEventDestinations } from '@metorial/state';
import { Button, Callout, Copy, Dialog, Input, showModal, Spacer, Text } from '@metorial/ui';
import { useState } from 'react';
import { useInstanceContext } from '../../lib/dataList';

export let showCreateEventDestinationModal = (p: {
  organizationId: string;
  onCreate: (created: { id: string }) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createDestination = useCreateEventDestination();
    let [created, setCreated] = useState<{
      id: string;
      signingSecret: string | null;
    } | null>(null);

    let form = useForm({
      initialValues: { name: '', description: '', url: '' },
      onSubmit: async values => {
        let [destination] = await createDestination.mutate({
          organizationId: p.organizationId,
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          type: 'webhook',
          webhook: { url: values.url.trim() }
        });

        if (!destination) return;

        setCreated({
          id: destination.id,
          signingSecret: destination.webhook?.signingSecret ?? null
        });
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string(),
          url: yup
            .string()
            .trim()
            .url('Enter a valid HTTPS URL')
            .required('Endpoint URL is required')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Create Event Destination</Dialog.Title>
        <Dialog.Description>
          Metorial POSTs events to this endpoint. Add subscriptions afterwards to choose which
          events it receives.
        </Dialog.Description>

        {created ? (
          <>
            {created.signingSecret ? (
              <>
                <Callout color="orange">
                  <span>
                    <strong>Copy the signing secret now.</strong> It is shown once and cannot
                    be retrieved later — you can only rotate it.
                  </span>
                </Callout>
                <Spacer size={12} />
                <Copy label="Signing Secret" value={created.signingSecret} />
              </>
            ) : (
              <Callout color="green">
                <span>Event destination created.</span>
              </Callout>
            )}

            <Spacer size={12} />
            <Text size="2" color="gray600">
              Verify every delivery by checking its signature against this secret.
            </Text>

            <Spacer size={18} />

            <Dialog.Actions>
              <Button
                type="button"
                onClick={() => {
                  close();
                  p.onCreate(created);
                }}
              >
                Done
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" required {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={10} />

            <Input
              label="Endpoint URL"
              required
              placeholder="https://example.com/metorial/webhooks"
              {...form.getFieldProps('url')}
            />
            <form.RenderError field="url" />

            <Spacer size={10} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={18} />

            <Dialog.Actions>
              <Button
                type="button"
                variant="outline"
                disabled={createDestination.isLoading}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createDestination.isLoading}
                success={createDestination.isSuccess}
              >
                Create Event Destination
              </Button>
            </Dialog.Actions>

            <createDestination.RenderError />
          </form>
        )}
      </Dialog.Wrapper>
    );
  });

export let EventDestinationsList = createDataList<{ organizationId: string }>(
  'event-destinations'
)
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] })
  }))
  .paginated(({ props, filters }) =>
    useEventDestinations(props.organizationId, { status: filters.status })
  )
  .columns([
    col.name({ header: 'Webhook', description: false }),
    col.text({
      id: 'endpoint',
      header: 'Endpoint',
      get: row => row.webhook?.url,
      fallback: 'Endpoint unavailable'
    }),
    col.status(lifecycleStatus, { isDefault: false }),
    col.count('listeners', row => row.listeners.length, 'listener', {
      header: 'Listeners',
      zero: 'No listeners'
    }),
    col.createdAt({ isDefault: false }),
    col.id({ header: 'Destination ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.eventDestination(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let EventDestinationsTable = ({ organizationId }: { organizationId: string }) => (
  <EventDestinationsList
    organizationId={organizationId}
    emptyState={{
      initial:
        'No webhooks yet. Create a webhook to start delivering events to your HTTPS endpoint.',
      filtered: 'No webhooks match your filters.'
    }}
  />
);
