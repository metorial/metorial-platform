import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackInstances,
  useCurrentInstance,
  useProvider,
  useProviderDeployment,
  useProviderTriggers
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Copy,
  MultiSelect,
  RenderDate,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';

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
  let updateCallback = callback.useUpdateMutator();
  let deployment = useProviderDeployment(instance.data?.id, callback.data?.providerDeployment.id);
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? callback.data?.providerDeployment.providerId
  );
  let providerVersionId = deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let availableTriggers = useProviderTriggers(instance.data?.id, providerVersionId, {
    limit: 100
  });
  let [selectedTriggerIds, setSelectedTriggerIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedTriggerIds(callback.data?.providerTriggers.map(trigger => trigger.providerTriggerId) ?? []);
  }, [callback.data?.id, callback.data?.updatedAt, callback.data?.providerTriggers]);

  let availableTriggerItems = useMemo(
    () =>
      (availableTriggers.data?.items ?? []).map(trigger => ({
        id: trigger.id,
        label: `${trigger.name} (${trigger.key})`
      })),
    [availableTriggers.data?.items]
  );

  let hasPendingTriggerChanges =
    selectedTriggerIds.slice().sort().join('|') !==
    (callback.data?.providerTriggers.map(trigger => trigger.providerTriggerId) ?? [])
      .slice()
      .sort()
      .join('|');

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
          title="Manage Triggers"
          description="Choose which provider triggers should create events for this callback."
        >
          {availableTriggers.data?.items.length ? (
            <>
              <MultiSelect
                label="Attached Triggers"
                description="Event type filters can still be added through the API if needed."
                placeholder="Select provider triggers"
                value={selectedTriggerIds}
                onChange={setSelectedTriggerIds}
                items={availableTriggerItems}
              />

              <Spacer height={15} />

              <DialogActionsWrapper>
                <Button
                  variant="outline"
                  onClick={() =>
                    setSelectedTriggerIds(
                      callback.data.providerTriggers.map(trigger => trigger.providerTriggerId)
                    )
                  }
                  disabled={!hasPendingTriggerChanges}
                >
                  Reset
                </Button>
                <Button
                  loading={updateCallback.isLoading}
                  disabled={!hasPendingTriggerChanges}
                  onClick={() =>
                    updateCallback.mutate({
                      triggers: selectedTriggerIds.map(triggerId => ({ triggerId }))
                    })
                  }
                >
                  Save Triggers
                </Button>
              </DialogActionsWrapper>

              <updateCallback.RenderError />
            </>
          ) : (
            <Callout color="gray">
              No provider triggers are available for this deployment yet.
            </Callout>
          )}
        </Box>

        <Spacer height={15} />

        <Box
          title="Provider Triggers"
          description="These provider triggers can create callback events for this callback."
        >
          {callback.data.providerTriggers.length > 0 ? (
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
          ) : (
            <Callout color="gray">
              No provider triggers have been attached to this callback yet.
            </Callout>
          )}
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

let DialogActionsWrapper = (p: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }}
  >
    {p.children}
  </div>
);
