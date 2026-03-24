import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackInstances,
  useCurrentInstance
} from '@metorial/state';
import { Attributes, Badge, Callout, Copy, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';

let getCallbackType = (
  triggers: {
    webhookUrl: string | null;
    pollIntervalSeconds: number | null;
  }[]
) => {
  if (triggers.some(trigger => trigger.webhookUrl)) return 'Webhook';
  if (triggers.some(trigger => trigger.pollIntervalSeconds != null)) return 'Polling';
  return 'Managed';
};

export let CallbackOverview = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);
  let instances = useCallbackInstances(instance.data?.id, p.callbackId, {
    order: 'desc'
  });

  return renderWithLoader({ callback, instances })(({ callback, instances }) => {
    let instanceItems = instances.data.items;
    let triggerInstances = instanceItems.flatMap(instance => instance.triggers);
    let webhookUrls = Array.from(
      new Set(triggerInstances.map(trigger => trigger.webhookUrl).filter(Boolean))
    );
    let nextPollAt = triggerInstances
      .map(trigger => trigger.nextPollAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return (
      <>
        <Attributes
          itemWidth="260px"
          attributes={[
            {
              label: 'Status',
              content: (
                <Badge color={callback.data.status === 'active' ? 'blue' : 'gray'}>
                  {callback.data.status}
                </Badge>
              )
            },
            {
              label: 'Type',
              content: getCallbackType(triggerInstances)
            },
            {
              label: 'Provider Deployment',
              content: callback.data.providerDeployment.name || callback.data.providerDeployment.id
            },
            {
              label: 'Next Poll At',
              content: nextPollAt ? <RenderDate date={nextPollAt} /> : 'N/A'
            },
            {
              label: 'ID',
              content: <ID id={callback.data.id} />
            },
            {
              label: 'Created At',
              content: <RenderDate date={callback.data.createdAt} />
            }
          ]}
        />

        <Spacer height={15} />

        {webhookUrls.length > 0 && (
          <>
            <Box
              title="Webhook URLs"
              description="Register these callback URLs with the external provider when webhook delivery is required."
            >
              {webhookUrls.map(url => (
                <div key={url}>
                  <Copy value={url ?? ''} />
                </div>
              ))}
            </Box>

            <Spacer height={15} />
          </>
        )}

        <Box
          title="Provider Triggers"
          description="These provider triggers can create callback events for this callback."
        >
          <Table
            headers={['Trigger', 'Key', 'Event Types']}
            data={callback.data.providerTriggers.map(trigger => ({
              data: [
                <Text size="2" weight="strong">
                  {trigger.providerTriggerName}
                </Text>,
                trigger.providerTriggerKey,
                trigger.eventTypes.length ? trigger.eventTypes.join(', ') : 'All'
              ]
            }))}
          />
        </Box>

        <Spacer height={15} />

        <Box
          title="Instances"
          description="Callback instances track registration state for provider configuration combinations."
        >
          {instanceItems.length > 0 ? (
            <Table
              headers={['Status', 'Registration', 'Triggers', 'Updated']}
              data={instanceItems.map(instance => ({
                data: [
                  <Badge color={instance.status === 'attached' ? 'blue' : 'gray'}>
                    {instance.status}
                  </Badge>,
                  <Badge
                    color={instance.registrationStatus === 'registered' ? 'blue' : 'orange'}
                  >
                    {instance.registrationStatus}
                  </Badge>,
                  <Text size="2">
                    {instance.triggers.length}{' '}
                    {instance.triggers.length === 1 ? 'trigger' : 'triggers'}
                  </Text>,
                  <RenderDate date={instance.updatedAt} />
                ]
              }))}
            />
          ) : (
            <Callout color="gray">
              No callback instances have been attached to this callback yet.
            </Callout>
          )}
        </Box>
      </>
    );
  });
};
