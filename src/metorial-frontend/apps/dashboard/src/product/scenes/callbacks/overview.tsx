import { capitalize } from '@lowerdeck/case';
import type { DashboardInstanceCallbacksInstancesListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackInstances,
  useCreateCallbackInstance,
  useCurrentInstance,
  useIntegrationInstances,
  useIntegrations,
  useProvider,
  useProviderDeployment,
  useProviderTriggers
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Datalist,
  Flex,
  Panel,
  RenderDate,
  Spacer,
  Text,
  confirm,
  toast
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useCallback as useReactCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import {
  AddProviderPanelFlow,
  type ProviderPanelSubmitInput
} from '../sessionTemplates/addProviderPanelFlow';
import { showCallbackProviderCreationPanel } from './callbackPanel';
import { CallbackCompactMultiSelect, CallbackMaskedValue } from './callbackFields';
import { buildCallbackConnectionUsageByConfigId } from './connections';
import { showCallbackSecretSetupModal, showCallbackTestEventModal } from './modal';
import {
  buildUnavailableCallbackInstanceCombinations,
  buildCallbackTriggerUpdateInput,
  canonicalizeCallbackTriggerInput,
  hasPendingCallbackReconciliation,
  shouldShowManualWebhookSetup,
  type UnavailableProviderCombination
} from './overviewLogic';

type CallbackInstanceListItem = DashboardInstanceCallbacksInstancesListOutput['items'][number];
type CallbackInstanceTrigger = CallbackInstanceListItem['triggers'][number];
let CALLBACK_RECONCILIATION_POLL_MS = 3000;
let CALLBACK_RECONCILIATION_MAX_ATTEMPTS = 10;

type CallbackReconciliationTarget = {
  expectedTriggerCount: number;
  callbackInstanceId?: string;
};

type CallbackReconciliationRun = CallbackReconciliationTarget & {
  runId: number;
  attempts: number;
};

let useCallbackReconciliationPolling = (p: {
  instances: readonly CallbackInstanceListItem[];
  refetchInstances: (() => void) | undefined;
}) => {
  let [run, setRun] = useState<CallbackReconciliationRun | null>(null);
  let nextRunId = useRef(0);
  let refetchInstances = useRef(p.refetchInstances);
  refetchInstances.current = p.refetchInstances;

  let hasPendingReconciliation = run
    ? hasPendingCallbackReconciliation({
        instances: p.instances,
        expectedTriggerCount: run.expectedTriggerCount,
        callbackInstanceId: run.callbackInstanceId
      })
    : false;
  let runId = run?.runId ?? null;
  let attempts = run?.attempts ?? 0;

  useEffect(() => {
    if (runId === null) return;

    if (
      attempts >= CALLBACK_RECONCILIATION_MAX_ATTEMPTS ||
      (attempts > 0 && !hasPendingReconciliation)
    ) {
      setRun(current => (current?.runId === runId ? null : current));
      return;
    }

    let timeout = window.setTimeout(() => {
      refetchInstances.current?.();
      setRun(current =>
        current?.runId === runId ? { ...current, attempts: current.attempts + 1 } : current
      );
    }, CALLBACK_RECONCILIATION_POLL_MS);

    return () => window.clearTimeout(timeout);
  }, [attempts, hasPendingReconciliation, runId]);

  let start = useReactCallback((target: CallbackReconciliationTarget) => {
    nextRunId.current += 1;
    setRun({ ...target, runId: nextRunId.current, attempts: 0 });
  }, []);

  return {
    isPolling: run !== null,
    start
  };
};

let formatPollingInterval = (seconds: number) => {
  if (seconds % 3600 === 0) {
    let hours = seconds / 3600;
    return `Every ${hours === 1 ? 'hour' : `${hours} hours`}`;
  }

  if (seconds % 60 === 0) {
    let minutes = seconds / 60;
    return `Every ${minutes === 1 ? 'minute' : `${minutes} minutes`}`;
  }

  return `Every ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
};

let CallbackTriggerSchedule = (p: { trigger: CallbackInstanceTrigger }) => {
  if (p.trigger.source !== 'polling') {
    return (
      <Text size="2" color="gray600">
        Event-driven
      </Text>
    );
  }

  let hasSchedule =
    p.trigger.pollIntervalSeconds || p.trigger.nextPollAt || p.trigger.lastPolledAt;

  if (!hasSchedule) {
    return (
      <Text size="2" color="gray600">
        Schedule pending
      </Text>
    );
  }

  return (
    <Flex direction="column" gap={2} style={{ minWidth: 150 }}>
      {p.trigger.pollIntervalSeconds ? (
        <Text size="2" weight="strong">
          {formatPollingInterval(p.trigger.pollIntervalSeconds)}
        </Text>
      ) : null}
      {p.trigger.nextPollAt ? (
        <Text size="1" color="gray600">
          Next poll: <RenderDate date={p.trigger.nextPollAt} />
        </Text>
      ) : null}
      {p.trigger.lastPolledAt ? (
        <Text size="1" color="gray600">
          Last poll: <RenderDate date={p.trigger.lastPolledAt} />
        </Text>
      ) : null}
    </Flex>
  );
};

let CallbackTriggerState = (p: { trigger: CallbackInstanceTrigger }) => {
  if (p.trigger.source === 'polling') {
    let isScheduled = Boolean(p.trigger.nextPollAt);
    return (
      <Badge color={isScheduled ? 'green' : 'orange'}>
        {isScheduled ? 'Scheduled' : 'Schedule pending'}
      </Badge>
    );
  }

  return (
    <Badge
      color={
        p.trigger.registrationStatus === 'registered'
          ? 'green'
          : p.trigger.registrationStatus === 'failed'
            ? 'red'
            : 'orange'
      }
    >
      {capitalize(p.trigger.registrationStatus)}
    </Badge>
  );
};

export let CallbackOverview = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callbackLoader = useCallback(instance.data?.id, p.callbackId);
  let instancesLoader = useCallbackInstances(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let updateCallback = callbackLoader.useUpdateMutator();
  let deployment = useProviderDeployment(
    instance.data?.id,
    callbackLoader.data?.providerDeployment.id
  );
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? callbackLoader.data?.providerDeployment.providerId
  );
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let availableTriggers = useProviderTriggers(
    instance.data?.id,
    providerVersionId ? { providerVersionId, limit: 100 } : null
  );
  let deleteCallbackInstance = instancesLoader.useDeleteMutator();
  // Callback instances only reference configs; resolve the owning integration
  // instances for "Integration › Instance" labels.
  let integrationsForUsage = useIntegrations(callbackLoader.data ? instance.data?.id : null, {
    providerId: callbackLoader.data?.providerDeployment.providerId,
    status: ['active'],
    limit: 100
  });
  let integrationInstancesForUsage = useIntegrationInstances(
    callbackLoader.data ? instance.data?.id : null,
    callbackLoader.data
      ? {
          providerDeploymentId: callbackLoader.data.providerDeployment.id,
          status: ['active'],
          limit: 100
        }
      : undefined
  );
  let connectionUsageByConfigId = useMemo(
    () =>
      callbackLoader.data
        ? buildCallbackConnectionUsageByConfigId({
            deploymentId: callbackLoader.data.providerDeployment.id,
            integrationInstances: integrationInstancesForUsage.data?.items ?? [],
            integrations: integrationsForUsage.data?.items ?? []
          })
        : new Map<string, string[]>(),
    [
      callbackLoader.data?.providerDeployment.id,
      integrationInstancesForUsage.data?.items,
      integrationsForUsage.data?.items
    ]
  );
  let [_, setSearchParams] = useSearchParams();
  let [selectedTriggerKeys, setSelectedTriggerKeys] = useState<string[]>([]);
  let reconciliationPolling = useCallbackReconciliationPolling({
    instances: instancesLoader.data?.items ?? [],
    refetchInstances: instancesLoader.refetch
  });

  useEffect(() => {
    let callbackTriggers = callbackLoader.data?.providerTriggers ?? [];
    setSelectedTriggerKeys(callbackTriggers.map(trigger => trigger.providerTrigger.key));
  }, [
    callbackLoader.data?.id,
    callbackLoader.data?.updatedAt,
    callbackLoader.data?.providerTriggers
  ]);

  let availableTriggerItems = useMemo(
    () =>
      (availableTriggers.data?.items ?? []).map(trigger => ({
        id: trigger.key,
        label: `${trigger.name} (${trigger.key})`
      })),
    [availableTriggers.data?.items]
  );
  let triggerSelectionSummary =
    selectedTriggerKeys.length === availableTriggerItems.length
      ? `All ${availableTriggerItems.length} triggers selected`
      : `${selectedTriggerKeys.length} of ${availableTriggerItems.length} triggers selected`;

  let selectedTriggerInput = buildCallbackTriggerUpdateInput(
    selectedTriggerKeys,
    callbackLoader.data?.providerTriggers ?? []
  );
  let existingTriggerInput = buildCallbackTriggerUpdateInput(
    callbackLoader.data?.providerTriggers.map(trigger => trigger.providerTrigger.key) ?? [],
    callbackLoader.data?.providerTriggers ?? []
  );
  let hasPendingTriggerChanges =
    canonicalizeCallbackTriggerInput(selectedTriggerInput) !==
    canonicalizeCallbackTriggerInput(existingTriggerInput);

  return renderWithLoader({ callback: callbackLoader, instances: instancesLoader, provider })(
    ({ callback, instances, provider }) => {
      let instanceItems = instances.data.items;
      let unavailableCombinations =
        buildUnavailableCallbackInstanceCombinations(instanceItems);
      let attachedInstanceCount = instanceItems.filter(
        instance => instance.status === 'attached'
      ).length;
      let manualSetupItems = instanceItems
        .filter(
          instance =>
            instance.status === 'attached' && shouldShowManualWebhookSetup(instance.triggers)
        )
        .map(instance => ({
          id: instance.id,
          label: instance.config.name || instance.config.id
        }));
      let isArchived = callback.data.status !== 'active';
      return (
        <>
          <Attributes
            columns={3}
            attributes={[
              {
                label: 'Provider',
                content: provider.data.name
              },
              {
                label: 'Instances',
                content: attachedInstanceCount
              },
              {
                label: 'ID',
                content: <ID id={callback.data.id} />
              }
            ]}
          />

          <Spacer height={15} />

          {isArchived && (
            <>
              <Callout color="orange">
                This callback is archived. Its trigger registrations have been removed and no
                events are received or delivered. Archiving cannot be undone from the
                dashboard.
              </Callout>

              <Spacer height={15} />
            </>
          )}

          {!isArchived && manualSetupItems.length > 0 && (
            <>
              <Box
                title="Manual Setup Required"
                description={`${provider.data.name} requires manual webhook configuration. Open each receiver's secure callback setup to create a secured URL and register it with the provider.`}
              >
                <Table
                  headers={['Receiver', '']}
                  data={manualSetupItems.map(item => ({
                    data: [
                      <Flex direction="column" gap={2} style={{ minWidth: 0 }}>
                        <Text size="2" weight="strong">
                          {item.label}
                        </Text>
                        <Text
                          size="2"
                          color="gray600"
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {item.id}
                        </Text>
                      </Flex>,
                      <Button
                        size="1"
                        variant="outline"
                        onClick={() =>
                          setSearchParams(params => {
                            params.set('callback_instance_id', item.id);
                            return params;
                          })
                        }
                      >
                        Open secure setup
                      </Button>
                    ]
                  }))}
                />
              </Box>

              <Spacer height={15} />
            </>
          )}

          <Box
            title="Events to Receive"
            description={`Choose which ${provider.data.name} triggers create events for this callback. Only the selected triggers are routed.`}
          >
            {isArchived ? (
              <Callout color="gray">
                This callback is archived, so its triggers are unregistered and can no longer
                be changed.
              </Callout>
            ) : availableTriggers.data?.items.length ? (
              <>
                <CallbackCompactMultiSelect
                  label="Triggers"
                  description="Select the provider triggers that should create callback events."
                  placeholder="Select provider triggers"
                  value={selectedTriggerKeys}
                  summary={triggerSelectionSummary}
                  onChange={setSelectedTriggerKeys}
                  items={availableTriggerItems}
                />

                <Spacer height={15} />

                <DialogActionsWrapper>
                  <Button
                    variant="outline"
                    size="2"
                    onClick={() => {
                      setSelectedTriggerKeys(
                        callback.data.providerTriggers.map(
                          trigger => trigger.providerTrigger.key
                        )
                      );
                    }}
                    disabled={!hasPendingTriggerChanges}
                  >
                    Reset
                  </Button>
                  <Button
                    loading={updateCallback.isLoading}
                    disabled={!hasPendingTriggerChanges}
                    size="2"
                    onClick={async () => {
                      let [result] = await updateCallback.mutate({
                        triggers: selectedTriggerInput
                      });
                      if (!result) return;

                      reconciliationPolling.start({
                        expectedTriggerCount: selectedTriggerInput.length
                      });
                    }}
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
            title="Instances"
            description={`This callback only receives ${provider.data.name} events from the instances listed here. Attach another instance to also route events from a different account or setup.`}
            rightActions={
              instance.data && callback.data?.id && !isArchived ? (
                <Flex align="center" gap={8}>
                  {reconciliationPolling.isPolling ? (
                    <Badge color="gray">Updating registrations</Badge>
                  ) : null}
                  <Button
                    size="1"
                    onClick={() =>
                      showCallbackInstanceFormModal({
                        instanceId: instance.data.id,
                        callbackId: callback.data.id,
                        providerDeploymentId: callback.data.providerDeployment.id,
                        providerName: provider.data.name,
                        unavailableCombinations,
                        onCreate: callbackInstanceId => {
                          instancesLoader.refetch?.();
                          reconciliationPolling.start({
                            expectedTriggerCount: callback.data.providerTriggers.length,
                            callbackInstanceId
                          });
                          setSearchParams(params => {
                            params.set('callback_instance_id', callbackInstanceId);
                            return params;
                          });
                        }
                      })
                    }
                  >
                    Attach Instance
                  </Button>
                </Flex>
              ) : undefined
            }
          >
            {instanceItems.length > 0 ? (
              <Table
                headers={['Status', 'Instance', 'Auth Config', 'Triggers', 'Updated']}
                data={instanceItems.map(instance => ({
                  data: [
                    <Badge color={instance.status === 'attached' ? 'blue' : 'gray'}>
                      {instance.status}
                    </Badge>,
                    <CallbackConnectionLabel
                      usageLabels={connectionUsageByConfigId.get(instance.config.id) ?? []}
                      config={instance.config}
                    />,
                    instance.authConfig ? (
                      <CallbackInstanceResourceLabel
                        id={instance.authConfig.id}
                        name={instance.authConfig.name}
                      />
                    ) : (
                      <span style={{ opacity: 0.5 }}>None</span>
                    ),
                    <Text size="2">
                      {instance.triggers.length}{' '}
                      {instance.triggers.length === 1 ? 'trigger' : 'triggers'}
                    </Text>,
                    <RenderDate date={instance.updatedAt} />
                  ],
                  onClick: () =>
                    setSearchParams(params => {
                      params.set('callback_instance_id', instance.id);
                      return params;
                    })
                }))}
              />
            ) : (
              <Callout color="gray">
                No instances are attached yet, so no events are being routed to this callback.
                Attach an instance to start receiving events.
              </Callout>
            )}
          </Box>

          <RouterPanel param="callback_instance_id" width={1000}>
            {callbackInstanceId => {
              let callbackInstance = instanceItems.find(
                instance => instance.id === callbackInstanceId
              );
              if (!callbackInstance || !instance.data) return null;

              return (
                <>
                  <Panel.Header>
                    <Panel.Title>Instance Details</Panel.Title>
                  </Panel.Header>

                  <Panel.Content>
                    <CallbackInstanceDetails
                      instanceId={instance.data.id}
                      callbackId={callback.data.id}
                      callbackInstance={callbackInstance}
                      providerName={provider.data.name}
                      readOnly={isArchived}
                      usageLabels={
                        connectionUsageByConfigId.get(callbackInstance.config.id) ?? []
                      }
                      deleteCallbackInstance={deleteCallbackInstance}
                      onRefresh={() => instancesLoader.refetch?.()}
                      onReattach={callbackInstanceId =>
                        reconciliationPolling.start({
                          expectedTriggerCount: callback.data.providerTriggers.length,
                          callbackInstanceId
                        })
                      }
                      onDetach={callbackInstanceId =>
                        confirm({
                          title: 'Detach instance',
                          description:
                            'Events from this instance will stop being routed to this callback. You can reattach it later.',
                          confirmText: 'Detach',
                          onConfirm: async () => {
                            let [res] = await deleteCallbackInstance.mutate({
                              callbackInstanceId
                            });

                            if (!res) return;

                            toast.success('Instance detached');
                            callbackLoader.refetch?.();
                            instancesLoader.refetch?.();
                            setSearchParams(params => {
                              params.delete('callback_instance_id');
                              return params;
                            });
                          }
                        })
                      }
                    />
                  </Panel.Content>
                </>
              );
            }}
          </RouterPanel>
        </>
      );
    }
  );
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

let CallbackInstanceResourceLabel = (p: { id: string; name: string | null }) => (
  <Flex direction="column" gap={2} style={{ minWidth: 0 }}>
    <Text size="2" weight="strong">
      {p.name ?? p.id}
    </Text>
    {p.name ? (
      <Text size="1" color="gray600">
        {p.id}
      </Text>
    ) : null}
  </Flex>
);

let CallbackConnectionLabel = (p: {
  usageLabels: readonly string[];
  config: { id: string; name: string | null };
}) => {
  let primary = p.usageLabels[0] ?? p.config.name ?? p.config.id;
  let extraUsageCount = p.usageLabels.length > 1 ? p.usageLabels.length - 1 : 0;
  let secondary = p.config.name ? `${p.config.name} · ${p.config.id}` : p.config.id;

  return (
    <Flex direction="column" gap={2} style={{ minWidth: 0 }}>
      <Text size="2" weight="strong">
        {primary}
        {extraUsageCount ? ` +${extraUsageCount} more` : ''}
      </Text>
      {primary !== secondary ? (
        <Text size="1" color="gray600">
          {secondary}
        </Text>
      ) : null}
    </Flex>
  );
};

let CallbackInstanceAttachPanelContent = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  providerName: string;
  unavailableCombinations: readonly UnavailableProviderCombination[];
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (callbackInstanceId: string) => void;
}) => {
  let createCallbackInstance = useCreateCallbackInstance();
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);

  if (deployment.isLoading) {
    return <Callout color="gray">Loading provider deployment...</Callout>;
  }

  if (!deployment.data) {
    return <Callout color="gray">Could not resolve the callback provider deployment.</Callout>;
  }

  return (
    <AddProviderPanelFlow
      close={p.close}
      setPanelWidth={p.setPanelWidth}
      instanceId={p.instanceId}
      providerId={deployment.data.providerId}
      hideProviderStep
      initialDeploymentId={p.providerDeploymentId}
      filterAvailableResources
      showToolFilters={false}
      ensureProviderConfig
      title="Attach Instance"
      description={`Route ${p.providerName} events from another config and optional auth config combination into this callback.`}
      action="Attach Instance"
      onSubmitProvider={async (input: ProviderPanelSubmitInput) => {
        if (!input.providerConfigId) {
          return {
            success: false,
            error: new Error('Select or create a provider config before attaching it.')
          };
        }

        let authConfigId = input.providerAuthConfigId || null;
        if (
          p.unavailableCombinations.some(
            combination =>
              combination.providerConfigId === input.providerConfigId &&
              combination.providerAuthConfigId === authConfigId
          )
        ) {
          return {
            success: false,
            error: new Error('This provider config and auth config pair is already attached.')
          };
        }

        let [result, error] = await createCallbackInstance.mutate({
          instanceId: p.instanceId,
          callbackId: p.callbackId,
          providerConfigId: input.providerConfigId,
          providerAuthConfigId: authConfigId ?? undefined
        });

        if (!result || error) return { success: false, error };

        p.onCreate?.(result.id);
        return { success: true };
      }}
      onComplete={() => {}}
    />
  );
};

let showCallbackInstanceFormModal = (p: {
  instanceId: string;
  callbackId: string;
  providerDeploymentId: string;
  providerName: string;
  unavailableCombinations: readonly UnavailableProviderCombination[];
  onCreate?: (callbackInstanceId: string) => void;
}) =>
  showCallbackProviderCreationPanel(({ close, setWidth }) => (
    <CallbackInstanceAttachPanelContent {...p} close={close} setPanelWidth={setWidth} />
  ));

let getCallbackInstanceStatusBadge = (status: CallbackInstanceListItem['status']) => (
  <Badge color={status === 'attached' ? 'blue' : 'gray'}>{status}</Badge>
);

let CallbackRegistrationStatus = (p: {
  status: CallbackInstanceListItem['registrationStatus'];
}) => (
  <Badge
    color={
      p.status === 'registered'
        ? 'green'
        : p.status === 'failed'
          ? 'red'
          : p.status === 'unregistered'
            ? 'gray'
            : 'orange'
    }
  >
    {capitalize(p.status)}
  </Badge>
);

let CallbackInstanceDetails = (p: {
  instanceId: string;
  callbackId: string;
  callbackInstance: CallbackInstanceListItem;
  providerName: string;
  readOnly: boolean;
  usageLabels: readonly string[];
  onDetach: (callbackInstanceId: string) => void;
  deleteCallbackInstance: ReturnType<
    ReturnType<typeof useCallbackInstances>['useDeleteMutator']
  >;
  onRefresh: () => void;
  onReattach: (callbackInstanceId: string) => void;
}) => {
  let receiverUrl = p.callbackInstance.webhookUrl;
  let hasReceiverPathSecret = Boolean(p.callbackInstance.receiverPathSecret);
  let triggers = p.callbackInstance.triggers;
  let isAttached = p.callbackInstance.status === 'attached';
  let reattachCallbackInstance = useCreateCallbackInstance();

  let openSecretSetup = (mode: 'create' | 'rotate') => {
    if (!receiverUrl) return;
    showCallbackSecretSetupModal({
      mode,
      instanceId: p.instanceId,
      callbackId: p.callbackId,
      callbackInstanceId: p.callbackInstance.id,
      receiverUrl,
      onComplete: p.onRefresh
    });
  };

  let requestRotation = () =>
    confirm({
      title: 'Rotate callback URL secret',
      description:
        'A new secured URL will be revealed once and the current URL will stop working immediately. Update the provider as soon as rotation completes.',
      confirmText: 'Rotate',
      onConfirm: async () => openSecretSetup('rotate')
    });

  let reattach = async () => {
    let [result] = await reattachCallbackInstance.mutate({
      instanceId: p.instanceId,
      callbackId: p.callbackId,
      providerConfigId: p.callbackInstance.config.id,
      providerAuthConfigId: p.callbackInstance.authConfig?.id ?? undefined
    });
    if (!result) return;

    toast.success('Instance reattached');
    p.onRefresh();
    p.onReattach(result.id);
  };

  return (
    <>
      <Box
        title="Instance"
        description={
          isAttached
            ? `This instance routes ${p.providerName} events into the callback and tracks the receiver registration for one provider config and optional auth config pair.`
            : `This instance is detached and its ${p.providerName} events are not routed to this callback. Reattach it to restore the same provider config and auth config combination.`
        }
        rightActions={
          p.readOnly ? undefined : !isAttached ? (
            <Button
              loading={reattachCallbackInstance.isLoading}
              success={reattachCallbackInstance.isSuccess}
              onClick={reattach}
              size="1"
            >
              Reattach Instance
            </Button>
          ) : (
            <Button
              size="1"
              variant="outline"
              onClick={() =>
                showCallbackTestEventModal({
                  instanceId: p.instanceId,
                  callbackId: p.callbackId,
                  callbackInstanceId: p.callbackInstance.id
                })
              }
            >
              Send Test Event
            </Button>
          )
        }
      >
        <Datalist
          items={[
            {
              label: 'Status',
              value: getCallbackInstanceStatusBadge(p.callbackInstance.status)
            },
            {
              label: 'Registration',
              value: (
                <CallbackRegistrationStatus status={p.callbackInstance.registrationStatus} />
              )
            },
            {
              label: 'Verification',
              value: p.callbackInstance.verificationMechanism
                ? capitalize(p.callbackInstance.verificationMechanism.replaceAll('_', ' '))
                : 'Pending'
            },
            ...(p.usageLabels.length
              ? [
                  {
                    label: 'Used In',
                    value: p.usageLabels.join(', ')
                  }
                ]
              : []),
            {
              label: 'ID',
              value: <ID id={p.callbackInstance.id} />
            },
            {
              label: 'Config ID',
              value: <ID id={p.callbackInstance.config.id} />
            },

            ...(p.callbackInstance.authConfig
              ? [
                  {
                    label: 'Auth Config ID',
                    value: <ID id={p.callbackInstance.authConfig.id} />
                  }
                ]
              : []),

            {
              label: 'Created At',
              value: <RenderDate date={p.callbackInstance.createdAt} />
            },
            {
              label: 'Updated At',
              value: <RenderDate date={p.callbackInstance.updatedAt} />
            }
          ]}
        />

        <Spacer height={5} />
        {!isAttached ? <reattachCallbackInstance.RenderError /> : null}
        {p.callbackInstance.registrationError ? (
          <Callout color="red">
            {p.callbackInstance.registrationError.code}:{' '}
            {p.callbackInstance.registrationError.message ??
              'The provider registration failed without additional details.'}
          </Callout>
        ) : null}
        {p.callbackInstance.lastRegistrationSyncError ? (
          <Callout color="red">
            {p.callbackInstance.lastRegistrationSyncError.code}:{' '}
            {p.callbackInstance.lastRegistrationSyncError.message ??
              'The latest registration synchronization failed.'}
          </Callout>
        ) : null}
      </Box>

      {isAttached ? (
        <>
          <Spacer height={15} />

          <Box
            title="Trigger Registrations"
            description={`Each row shows how one ${p.providerName} trigger delivers events through this instance — via a registered webhook or scheduled polling.`}
          >
            {p.callbackInstance.triggers.length > 0 ? (
              <Table
                headers={['Trigger', 'Type', 'State', 'Schedule', 'Verification']}
                data={triggers.map(trigger => ({
                  data: [
                    trigger.providerTrigger?.name ?? 'Unknown Trigger',
                    <Badge color={trigger.source === 'polling' ? 'blue' : 'purple'}>
                      {trigger.source === 'polling' ? 'Polling' : 'Webhook'}
                    </Badge>,
                    <CallbackTriggerState trigger={trigger} />,
                    <CallbackTriggerSchedule trigger={trigger} />,
                    <Badge color="gray">{trigger.verificationMechanism}</Badge>
                  ]
                }))}
              />
            ) : (
              <Text size="2" color="gray600">
                No trigger registrations have been created for this instance yet.
              </Text>
            )}
            {triggers
              .filter(trigger => trigger.registrationError)
              .map(trigger => (
                <Callout color="red" key={trigger.id}>
                  {trigger.registrationError!.code}:{' '}
                  {trigger.registrationError!.message ?? 'No detail'}
                  {trigger.registrationError!.at
                    ? ` at ${trigger.registrationError!.at.toISOString()}`
                    : ''}
                </Callout>
              ))}
          </Box>

          <Spacer height={15} />

          {receiverUrl && !p.readOnly && (
            <>
              <Box
                title="Secure callback setup"
                description="Configure the provider with the secured receiver URL. Generated URL secrets are masked after their one-time reveal."
              >
                <CallbackMaskedValue
                  label="Secure callback URL"
                  value={`${receiverUrl.replace(/\/$/, '')}/••••••••`}
                />
                <Spacer height={10} />
                <Text size="2" color="gray600">
                  {hasReceiverPathSecret
                    ? 'The active URL cannot be copied because its secret is no longer available. Rotate the secret to reveal and copy a new URL.'
                    : 'Create a URL secret to reveal and copy the complete URL once.'}
                </Text>
                <Spacer height={8} />
                <Text size="2" color="gray600">
                  Provider instructions: after revealing and copying the complete URL, add it
                  as the webhook destination, select the event types listed above, and keep the
                  configured verification mechanism unchanged while the registration is active.
                </Text>
                <Spacer height={15} />
                <Flex gap={8}>
                  {!hasReceiverPathSecret ? (
                    <Button size="1" onClick={() => openSecretSetup('create')}>
                      Create secure URL
                    </Button>
                  ) : (
                    <Button size="1" variant="outline" onClick={requestRotation}>
                      Rotate secret
                    </Button>
                  )}
                </Flex>
              </Box>
              <Spacer height={15} />
            </>
          )}

          {!p.readOnly ? (
            <Box
              title="Danger Zone"
              description={`Detach this instance to stop routing its ${p.providerName} events to this callback. You can reattach it later.`}
            >
              <Button
                color="red"
                loading={p.deleteCallbackInstance.isLoading}
                success={p.deleteCallbackInstance.isSuccess}
                onClick={() => p.onDetach(p.callbackInstance.id)}
                size="2"
              >
                Detach Instance
              </Button>
            </Box>
          ) : null}
        </>
      ) : null}
    </>
  );
};
