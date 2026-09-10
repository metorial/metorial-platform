import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  EventDestinationPreview,
  useCreateEventDestination,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestinations
} from '@metorial/state';
import {
  getEnumListFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import {
  Badge,
  Button,
  Callout,
  Copy,
  Dialog,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useState } from 'react';
import { getStatusColor } from './shared';

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

type EventDestinationsTableProps = {
  organizationId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useEventDestinationsTableState: TableStateProvider<
  EventDestinationsTableProps,
  EventDestinationPreview,
  TableStateProviderResult<EventDestinationPreview>
> = (props, opts) => {
  let destinations = useEventDestinations(props.organizationId, {
    status: getEnumListFilterValue(opts.filter.status, ['active', 'archived'])
  });

  return {
    isLoading: destinations.isLoading,
    error: destinations.error,
    hasMoreAfter: destinations.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: destinations.data?.pagination.hasMoreBefore ?? false,
    items: destinations.data?.items ?? [],
    loadNext: destinations.next,
    loadPrevious: destinations.previous
  };
};

let eventDestinationsTable = new DashboardTable<
  EventDestinationsTableProps,
  EventDestinationPreview
>('event-destinations')
  .state(useEventDestinationsTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Destination',
      render: destination => (
        <div>
          <Text size="2" weight="strong">
            {destination.name}
          </Text>
          <Text size="1" color="gray600">
            {destination.webhook?.url ?? 'No endpoint'}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: destination => (
        <Badge color={getStatusColor(destination.status)}>{destination.status}</Badge>
      )
    },
    {
      id: 'listeners',
      isDefault: true,
      header: 'Subscriptions',
      render: destination =>
        destination.listeners.length ? (
          <Text size="2">
            {destination.listeners.length}{' '}
            {destination.listeners.length === 1 ? 'subscription' : 'subscriptions'}
          </Text>
        ) : (
          <Badge color="orange">None</Badge>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: destination => <RenderDate date={destination.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Destination ID',
      render: destination => <ID id={destination.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' }
      ]
    }
  ])
  .link((destination, props) =>
    Paths.instance.eventDestination(
      props.organization.data,
      props.project.data,
      props.instance.data,
      destination.id
    )
  )
  .build();

export let EventDestinationsTable = ({ organizationId }: { organizationId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return eventDestinationsTable({
    organizationId,
    instance,
    organization,
    project,
    emptyState:
      'No event destinations yet. Create one to have Metorial deliver callback events to your own endpoint.'
  });
};
