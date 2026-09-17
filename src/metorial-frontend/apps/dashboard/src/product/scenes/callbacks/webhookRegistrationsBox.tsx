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
import { truncateReceiverUrl } from './shared';
import { CreateWebhookRegistrationButton } from './webhookRegistrationsTable';

export let ProviderWebhookRegistrationsBox = ({
  instanceId,
  provider
}: {
  instanceId: string;
  provider: { id: string; name: string };
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let registrations = useWebhookRegistrations(instanceId, {
    order: 'desc',
    providerId: provider.id
  });

  let onCreate = () => void registrations.refetch();

  return (
    <>
      <Box
        title="Inbound Event Setup"
        description={`Tool calls to ${provider.name} work without this, but inbound events require a webhook receiver registered with the provider.`}
        rightActions={
          registrations.data && !registrations.data.items.length ? (
            <CreateWebhookRegistrationButton
              instanceId={instanceId}
              provider={provider}
              onCreate={onCreate}
            />
          ) : undefined
        }
      >
        {renderWithPagination(registrations, {
          hidePaginationWhenUnavailable: true,
          emptyState: (
            <>
              <Callout color="orange">
                <div>
                  <Text size="2" weight="strong">
                    Action Required to Receive Events
                  </Text>
                  <Spacer size={4} />
                  <Text size="2">
                    Create a receiver, add its secure URL in {provider.name}, then enter any
                    verification values requested by the provider. Metorial will guide you
                    through each step.
                  </Text>
                </div>
              </Callout>
              <Spacer size={12} />
              <CreateWebhookRegistrationButton
                instanceId={instanceId}
                provider={provider}
                onCreate={onCreate}
              />
            </>
          )
        })(registrations => (
          <Table
            headers={['Receiver', 'Receive URL']}
            data={registrations.data.items.map(registration => ({
              href: Paths.instance.webhookRegistration(
                organization.data,
                project.data,
                instance.data,
                registration.id
              ),
              data: [
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{registration.name}</span>

                  {registration.status === 'awaiting_setup' && (
                    <Badge color="orange" size="1">
                      Awaiting Setup
                    </Badge>
                  )}
                </div>,

                registration.receiveUrl ? (
                  <Text size="1" style={{ fontFamily: 'jetbrains mono, monospace' }}>
                    {truncateReceiverUrl(registration.receiveUrl)}
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
      <ProviderWebhookRegistrationsBox
        instanceId={instanceId}
        provider={{ id: providerId, name: provider.data.name }}
      />
    );
  });
};
