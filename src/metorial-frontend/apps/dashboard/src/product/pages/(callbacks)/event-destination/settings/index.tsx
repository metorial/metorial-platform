import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDestination
} from '@metorial/state';
import {
  Button,
  Callout,
  confirm,
  Copy,
  Dialog,
  Input,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { DeleteResourceDangerZone } from '../../../../scenes/deleteResourceDangerZone';

let FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

let showRotatedSecretModal = (signingSecret: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={600}>
      <Dialog.Title>New Signing Secret</Dialog.Title>
      <Dialog.Description>
        The previous secret is invalid. Update your webhook verifier before accepting more
        deliveries.
      </Dialog.Description>

      <Callout color="orange">
        <span>
          <strong>Copy this secret now.</strong> It cannot be retrieved later.
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

export let EventDestinationGeneralSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { eventDestinationId } = useParams();
  let destination = useEventDestination(organization.data?.id, eventDestinationId);
  let updateDestination = destination.useUpdateMutator();
  let rotateSecret = destination.useRotateWebhookSecretMutator();
  let archiveDestination = destination.useArchiveMutator();
  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: destination.data?.name ?? '',
      url: destination.data?.webhook?.url ?? '',
      description: destination.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateDestination.mutate({
        name: values.name.trim(),
        description: values.description.trim() || null,
        webhook: { url: values.url.trim() }
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        url: yup
          .string()
          .trim()
          .url('Enter a valid HTTPS URL')
          .matches(/^https:\/\//i, 'Webhook URL must use HTTPS')
          .required('Webhook URL is required'),
        description: yup.string()
      })
  });

  return renderWithLoader({ destination, organization, project, instance })(
    ({ destination, organization, project, instance }) => {
      let isArchived = destination.data.status === 'archived';
      let isMutating =
        updateDestination.isLoading || rotateSecret.isLoading || archiveDestination.isLoading;

      return (
        <>
          <Box
            title="General"
            description="Update the webhook name, HTTPS endpoint, and internal description."
          >
            <form onSubmit={form.handleSubmit}>
              <Input
                label="Name"
                required
                disabled={isArchived}
                {...form.getFieldProps('name')}
              />
              <form.RenderError field="name" />
              <Spacer size={15} />

              <Input
                label="HTTPS URL"
                required
                disabled={isArchived}
                placeholder="https://example.com/metorial/webhooks"
                {...form.getFieldProps('url')}
              />
              <form.RenderError field="url" />
              <Spacer size={15} />

              <Input
                as="textarea"
                minRows={5}
                maxRows={12}
                label="Description"
                disabled={isArchived}
                {...form.getFieldProps('description')}
              />
              <form.RenderError field="description" />
              <Spacer size={15} />

              <FormActions>
                <Button
                  size="2"
                  type="submit"
                  loading={updateDestination.isLoading}
                  success={updateDestination.isSuccess}
                  disabled={
                    isArchived || rotateSecret.isLoading || archiveDestination.isLoading
                  }
                >
                  Save Changes
                </Button>
              </FormActions>

              <updateDestination.RenderError />
            </form>
          </Box>

          <Spacer size={20} />

          <Box
            title="Signing Secret"
            description="Metorial signs every delivery with this secret. Rotation immediately invalidates the previous secret."
          >
            <Text size="2" color="gray600">
              Signing secrets are only shown when the webhook is created or rotated.
            </Text>
            <Spacer size={15} />
            <Button
              size="2"
              color="red"
              variant="outline"
              loading={rotateSecret.isLoading}
              success={rotateSecret.isSuccess}
              disabled={
                isArchived || updateDestination.isLoading || archiveDestination.isLoading
              }
              onClick={() =>
                confirm({
                  title: 'Rotate Signing Secret?',
                  description:
                    'The current secret will stop working immediately. Deliveries will fail until your endpoint uses the new secret.',
                  confirmText: 'Rotate',
                  onConfirm: async () => {
                    let [rotated] = await rotateSecret.mutate({});
                    if (!rotated?.webhook?.signingSecret) return;
                    showRotatedSecretModal(rotated.webhook.signingSecret);
                  }
                })
              }
            >
              Rotate Signing Secret
            </Button>
            <rotateSecret.RenderError />
          </Box>

          <Spacer size={20} />

          <DeleteResourceDangerZone
            description="Archiving stops deliveries and removes this webhook's listeners. Recorded events remain available."
            buttonLabel="Archive Webhook"
            confirmTitle={`Archive ${destination.data.name}?`}
            confirmDescription="Metorial will stop delivering events to this endpoint."
            confirmText="Archive"
            loading={archiveDestination.isLoading}
            success={archiveDestination.isSuccess}
            disabled={isArchived || isMutating}
            onDelete={async () => {
              let [archived] = await archiveDestination.mutate({});
              if (!archived) return;

              navigate(
                Paths.instance.eventDestinations(
                  organization.data,
                  project.data,
                  instance.data
                )
              );
            }}
          />
          <archiveDestination.RenderError />
        </>
      );
    }
  );
};
