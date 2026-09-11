import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useProvider, useWebhookRegistrations } from '@metorial/state';
import { Badge, Callout, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import {
  CreateWebhookRegistrationButton,
  showWebhookRegistrationSetup
} from './webhookRegistrationsTable';
import {
  getWebhookRegistrationStatusColor,
  WEBHOOK_REGISTRATION_STATUS_LABELS
} from './shared';

let CallbackWebhookRegistrationsTable = ({
  instanceId,
  providerId
}: {
  instanceId: string;
  providerId: string;
}) => {
  let registrations = useWebhookRegistrations(instanceId, { order: 'desc', providerId });

  return (
    <>
      <Box
        title="Webhook Receivers"
        description="This provider needs a receiver registered in its own dashboard before it can deliver events."
        rightActions={
          registrations.data?.items.length ? (
            <CreateWebhookRegistrationButton
              instanceId={instanceId}
              onCreate={() => registrations.refetch()}
            />
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
              <CreateWebhookRegistrationButton
                instanceId={instanceId}
                onCreate={() => registrations.refetch()}
              />
            </>
          )
        })(registrations => (
          <Table
            headers={['Receiver', 'Status', 'Receive URL', 'Created', '']}
            padding={{ sides: '16px' }}
            data={registrations.data.items.map(registration => ({
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
                ),
                <RenderDate date={registration.createdAt} />,
                <ID id={registration.id} />
              ],
              onClick:
                registration.status === 'active'
                  ? undefined
                  : () =>
                      showWebhookRegistrationSetup({
                        instanceId,
                        registration,
                        onComplete: () => registrations.refetch()
                      })
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
