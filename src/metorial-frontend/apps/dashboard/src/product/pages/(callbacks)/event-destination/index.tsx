import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestination
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  confirm,
  Copy,
  Dialog,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { EventDestinationListenersBox } from '../../../scenes/callbacks/listenersBox';
import { getStatusColor } from '../../../scenes/callbacks/shared';

let showRotatedSecretModal = (signingSecret: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={600}>
      <Dialog.Title>New Signing Secret</Dialog.Title>
      <Dialog.Description>
        The previous secret no longer signs deliveries. Update your endpoint now.
      </Dialog.Description>

      <Callout color="orange">
        <span>
          <strong>Copy this secret now.</strong> It is shown once and cannot be retrieved
          later.
        </span>
      </Callout>

      <Spacer size={12} />

      <Copy label="Signing Secret" value={signingSecret} />

      <Spacer size={18} />

      <Dialog.Actions>
        <Button type="button" onClick={close}>
          Done
        </Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  ));

export let EventDestinationPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);
  let updateMutator = destination.useUpdateMutator();
  let archiveMutator = destination.useArchiveMutator();
  let rotateMutator = destination.useRotateWebhookSecretMutator();
  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: destination.data?.name ?? '',
      description: destination.data?.description ?? '',
      url: destination.data?.webhook?.url ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || null,
        webhook: { url: values.url.trim() }
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

  return renderWithLoader({ destination, organization, project, instance })(
    ({ destination, organization, project, instance }) => (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            { label: 'ID', content: <ID id={destination.data.id} /> },
            {
              label: 'Status',
              content: (
                <Badge size="1" color={getStatusColor(destination.data.status)}>
                  {destination.data.status}
                </Badge>
              )
            },
            {
              label: 'Subscriptions',
              content: `${destination.data.listeners.length}`
            },
            { label: 'Created', content: <RenderDate date={destination.data.createdAt} /> }
          ]}
        />

        <Spacer height={20} />

        <Box
          title="Endpoint"
          description="Metorial POSTs every matching event to this URL and signs it with the destination's signing secret."
        >
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" required {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={15} />

            <Input
              label="Endpoint URL"
              required
              placeholder="https://example.com/metorial/webhooks"
              {...form.getFieldProps('url')}
            />
            <form.RenderError field="url" />

            <Spacer size={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="2"
                type="submit"
                loading={updateMutator.isLoading}
                success={updateMutator.isSuccess}
                disabled={rotateMutator.isLoading || archiveMutator.isLoading}
              >
                Save
              </Button>
            </div>

            <updateMutator.RenderError />
          </form>
        </Box>

        <Spacer height={20} />

        <EventDestinationListenersBox
          organizationId={organization.data.id}
          instanceId={instance.data.id}
          eventDestinationId={destination.data.id}
          onComplete={() => void destination.refetch()}
        />

        <Spacer height={20} />

        <Box
          title="Signing Secret"
          description="Every delivery carries a signature generated from this secret. Rotate it if it may have leaked — the old secret stops working immediately."
        >
          <Text size="2" color="gray600">
            The secret is only shown once, when it is created or rotated.
          </Text>

          <Spacer size={15} />

          <Button
            size="2"
            variant="outline"
            loading={rotateMutator.isLoading}
            success={rotateMutator.isSuccess}
            disabled={updateMutator.isLoading || archiveMutator.isLoading}
            onClick={() =>
              confirm({
                title: 'Rotate Signing Secret?',
                description:
                  'Deliveries are signed with the new secret straight away. Any endpoint still verifying with the old secret will reject them.',
                confirmText: 'Rotate',
                onConfirm: async () => {
                  let [rotated] = await rotateMutator.mutate({});
                  if (!rotated?.webhook?.signingSecret) return;

                  showRotatedSecretModal(rotated.webhook.signingSecret);
                }
              })
            }
          >
            Rotate Signing Secret
          </Button>

          <rotateMutator.RenderError />
        </Box>

        <Spacer height={20} />

        <DeleteResourceDangerZone
          description="Archiving stops all deliveries to this endpoint and removes its subscriptions."
          buttonLabel="Archive Destination"
          confirmTitle={`Archive ${destination.data.name}?`}
          confirmDescription="Metorial stops delivering events to this endpoint. Events already recorded are kept."
          confirmText="Archive"
          loading={archiveMutator.isLoading}
          success={archiveMutator.isSuccess}
          disabled={destination.data.status === 'archived'}
          onDelete={async () => {
            let [res] = await archiveMutator.mutate({});
            if (!res) return;

            navigate(
              Paths.instance.eventDestinations(organization.data, project.data, instance.data)
            );
          }}
        />
      </>
    )
  );
};
