import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useWebhookRegistrations
} from '@metorial/state';
import { Badge, Callout, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import {
  getWebhookRegistrationStatusColor,
  WEBHOOK_REGISTRATION_STATUS_LABELS
} from './shared';
import { CreateWebhookRegistrationButton } from './webhookRegistrationsTable';

let CallbackWebhookRegistrationsTable = ({
  instanceId,
  providerId
}: {
  instanceId: string;
  providerId: string;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let registrations = useWebhookRegistrations(instanceId, { order: 'desc', providerId });

  let onCreate = (created: { id: string }) => {
    registrations.refetch();
    navigate(
      Paths.instance.webhookRegistration(
        organization.data,
        project.data,
        instance.data,
        created.id
      )
    );
  };

  return (
    <>
      <Box
        title="Webhook Receivers"
        description="This provider needs a receiver registered in its own dashboard before it can deliver events."
        rightActions={
          registrations.data?.items.length ? (
            <CreateWebhookRegistrationButton instanceId={instanceId} onCreate={onCreate} />
          ) : undefined
        }
      >
        {renderWithPagination(registrations, {
          hidePaginationWhenUnavailable: true,
          emptyState: (
            <>
              <Callout color="orange">
                <span>
                  This provider needs a webhook receiver before it can deliver events. Set one
                  up to get a receive URL for the provider's dashboard.
                </span>
              </Callout>
              <Spacer size={12} />
              <CreateWebhookRegistrationButton instanceId={instanceId} onCreate={onCreate} />
            </>
          )
        })(registrations => (
          <Table
            headers={['Receiver', 'Status', 'Receive URL']}
            data={registrations.data.items.map(registration => ({
              href: Paths.instance.webhookRegistration(
                organization.data,
                project.data,
                instance.data,
                registration.id
              ),
              data: [
                registration.name,
                <Badge color={getWebhookRegistrationStatusColor(registration.status)}>
                  {WEBHOOK_REGISTRATION_STATUS_LABELS[registration.status] ??
                    registration.status}
                </Badge>,
                registration.receiveUrl ? (
                  <Text size="1" style={{ fontFamily: 'jetbrains mono, monospace' }}>
                    {registration.receiveUrl}
                  </Text>
                ) : (
                  <Text size="2" color="gray600">
                    Not provisioned
                  </Text>
                )
              ]
            }))}
          />
        ))}
      </Box>

      <Spacer height={20} />
    </>
  );
};

export let CallbackWebhookRegistrationsBox = ({
  instanceId,
  providerId
}: {
  instanceId: string;
  providerId: string;
}) => {
  let provider = useProvider(instanceId, providerId);

  return renderWithLoader({ provider })(({ provider }) => {
    let needsManualRegistration =
      provider.data.type.triggers.status === 'enabled' &&
      provider.data.type.triggers.webhookRegistration.status === 'supported';

    if (!needsManualRegistration) return null;

    return (
      <CallbackWebhookRegistrationsTable instanceId={instanceId} providerId={providerId} />
    );
  });
};
