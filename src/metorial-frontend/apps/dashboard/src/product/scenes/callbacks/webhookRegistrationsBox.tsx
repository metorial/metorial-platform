import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList, EmptyValue, StatusBadge } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProvider, useWebhookRegistrations } from '@metorial/state';
import { Callout, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useInstanceContext } from '../../lib/dataList';
import { truncateReceiverUrl } from './shared';
import {
  CreateWebhookRegistrationButton,
  webhookRegistrationStatus
} from './webhookRegistrationsTable';

let ProviderWebhookRegistrationsList = createDataList<{
  instanceId: string;
  providerId: string;
}>('provider-webhook-registrations', { customizable: false })
  .context(useInstanceContext)
  .paginated(({ props }) =>
    useWebhookRegistrations(props.instanceId, { order: 'desc', providerId: props.providerId })
  )
  .columns([
    col.custom({
      id: 'receiver',
      header: 'Receiver',
      render: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text size="2">{row.name}</Text>

          {row.status === 'awaiting_setup' && (
            <StatusBadge status={row.status} descriptor={webhookRegistrationStatus} />
          )}
        </div>
      )
    }),
    col.custom({
      id: 'receiveUrl',
      header: 'Receive URL',
      render: row =>
        row.receiveUrl ? (
          <Text size="2" style={{ fontFamily: 'jetbrains mono, monospace' }}>
            {truncateReceiverUrl(row.receiveUrl)}
          </Text>
        ) : (
          <EmptyValue>Not provisioned</EmptyValue>
        )
    })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.webhookRegistration(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let ProviderWebhookRegistrationsBox = ({
  instanceId,
  provider
}: {
  instanceId: string;
  provider: { id: string; name: string };
}) => {
  let registrations = useWebhookRegistrations(instanceId, {
    order: 'desc',
    providerId: provider.id
  });

  return (
    <>
      <Box
        title="Inbound Event Setup"
        description={`Tool calls to ${provider.name} work without this, but inbound events require a webhook receiver registered with the provider.`}
        rightActions={
          registrations.data && !registrations.data.items.length ? (
            <CreateWebhookRegistrationButton instanceId={instanceId} provider={provider} />
          ) : undefined
        }
      >
        <ProviderWebhookRegistrationsList
          listVariant="embedded"
          instanceId={instanceId}
          providerId={provider.id}
          emptyState={{
            initial: () => (
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
            )
          }}
        />
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
