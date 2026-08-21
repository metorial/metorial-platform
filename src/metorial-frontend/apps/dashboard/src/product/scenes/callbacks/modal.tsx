import type { DashboardInstanceCallbacksCreateOutput } from '@metorial/dashboard-sdk';
import {
  useCreateCallback,
  useCreateCallbackReceiverPathSecret,
  useCreateCallbackInstance,
  useIntegrationInstances,
  useIntegrations,
  useProvider,
  useProviderDeployment,
  useProviderListing,
  useProviderTriggers,
  useRotateCallbackReceiverPathSecret,
  useSendCallbackTestEvent
} from '@metorial/state';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Copy,
  Dialog,
  Flex,
  Input,
  Spacer,
  Text,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import styled from 'styled-components';
import { ProviderCreationPanelShell, ProviderSelectionStep } from '../providerCreationPanel';
import { showCallbackProviderCreationPanel } from './callbackPanel';
import {
  buildCallbackConnectionDisplayItems,
  buildCallbackConnectionOptions,
  type CallbackConnectionDisplayItem
} from './connections';
import { CallbackCompactMultiSelect, CallbackMaskedValue } from './callbackFields';

let FocusedStep = (p: { children: ReactNode }) => (
  <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>{p.children}</div>
);

let ConnectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 480px);
  min-height: 120px;
  overflow-y: auto;
`;

let ConnectionCard = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  background: ${p => (p.$selected ? theme.colors.blue200 : theme.colors.background)};
  border: 1px solid ${p => (p.$selected ? theme.colors.primary400 : theme.colors.gray400)};
  transition:
    border-color 0.12s ease,
    background 0.12s ease;

  &:hover:not(:disabled) {
    border-color: ${p => (p.$selected ? theme.colors.primary400 : theme.colors.gray600)};
  }

  &:disabled {
    cursor: default;
    opacity: 0.7;
  }
`;

let ConnectionRadio = styled.span<{ $selected: boolean }>`
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 999px;
  border: ${p =>
    p.$selected
      ? `5px solid ${theme.colors.primary500}`
      : `1.5px solid ${theme.colors.gray500}`};
  background: ${theme.colors.background};
`;

let RecapCard = styled.div`
  padding: 14px 16px;
  border-radius: 10px;
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray400};
`;

export let CallbackCreatePanelFlow = (p: {
  instanceId: string;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) => {
  let { close, instanceId, onCreate, setPanelWidth } = p;
  let [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  let [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  let [connectionSearch, setConnectionSearch] = useState('');
  let [callbackName, setCallbackName] = useState('');
  let [nameTouched, setNameTouched] = useState(false);
  let [selectedTriggerKeys, setSelectedTriggerKeys] = useState<string[]>([]);
  let [triggersTouched, setTriggersTouched] = useState(false);
  let [createdCallback, setCreatedCallback] =
    useState<DashboardInstanceCallbacksCreateOutput | null>(null);
  let [currentStep, setCurrentStep] = useState(0);
  let createCallback = useCreateCallback();
  let createCallbackInstance = useCreateCallbackInstance();
  let providerListing = useProviderListing(instanceId, selectedProviderId);
  let provider = useProvider(instanceId, selectedProviderId);
  let integrations = useIntegrations(selectedProviderId ? instanceId : null, {
    providerId: selectedProviderId ?? undefined,
    status: ['active'],
    order: 'desc',
    limit: 100
  });
  let integrationInstances = useIntegrationInstances(
    selectedProviderId ? instanceId : null,
    selectedProviderId
      ? {
          providerId: selectedProviderId,
          status: ['active'],
          order: 'desc',
          limit: 100
        }
      : undefined
  );

  let connectionOptions = useMemo(
    () =>
      selectedProviderId
        ? buildCallbackConnectionDisplayItems(
            buildCallbackConnectionOptions({
              providerId: selectedProviderId,
              integrationInstances: integrationInstances.data?.items ?? [],
              integrations: integrations.data?.items ?? []
            })
          )
        : [],
    [selectedProviderId, integrationInstances.data?.items, integrations.data?.items]
  );
  let selectedConnection =
    connectionOptions.find(option => option.id === selectedConnectionId) ?? null;

  let deployment = useProviderDeployment(instanceId, selectedConnection?.deploymentId);
  let providerVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let availableTriggers = useProviderTriggers(
    instanceId,
    providerVersionId ? { providerVersionId, limit: 100 } : null
  );
  let availableTriggerItems = useMemo(
    () =>
      (availableTriggers.data?.items ?? []).map(trigger => ({
        id: trigger.key,
        label: `${trigger.name} (${trigger.key})`
      })),
    [availableTriggers.data?.items]
  );
  let availableTriggerKeysKey = (availableTriggers.data?.items ?? [])
    .map(trigger => trigger.key)
    .join(':');
  // Pending until the deployment-version chain resolves; otherwise the empty state
  // flashes and a zero-trigger callback could be created.
  let isTriggerListPending =
    !!selectedConnection &&
    (availableTriggers.isLoading ||
      deployment.isLoading ||
      provider.isLoading ||
      (!!providerVersionId && !availableTriggers.data));

  let providerName = providerListing.data?.name ?? provider.data?.name ?? 'this provider';
  let defaultCallbackName = selectedConnection
    ? `${providerName} · ${selectedConnection.integrationInstanceName}`
    : `${providerName} Callback`;
  let effectiveCallbackName = nameTouched ? callbackName : defaultCallbackName;
  let triggerSelectionSummary =
    selectedTriggerKeys.length === availableTriggerItems.length
      ? `All ${availableTriggerItems.length} triggers selected`
      : `${selectedTriggerKeys.length} of ${availableTriggerItems.length} triggers selected`;

  useEffect(() => {
    setPanelWidth(1100);
  }, [setPanelWidth]);

  // Preselect the only connection; drop a selection that no longer exists.
  useEffect(() => {
    if (createdCallback) return;
    if (
      selectedConnectionId &&
      connectionOptions.some(option => option.id === selectedConnectionId)
    ) {
      return;
    }

    setSelectedConnectionId(connectionOptions.length === 1 ? connectionOptions[0]!.id : null);
  }, [connectionOptions, selectedConnectionId, createdCallback]);

  // A callback without triggers never registers anything, so default to all triggers.
  useEffect(() => {
    if (createdCallback) return;
    let availableKeys = availableTriggers.data?.items.map(trigger => trigger.key);
    if (!availableKeys) return;

    if (!triggersTouched) {
      setSelectedTriggerKeys(availableKeys);
      return;
    }

    setSelectedTriggerKeys(current => current.filter(key => availableKeys.includes(key)));
  }, [availableTriggerKeysKey, triggersTouched, createdCallback]);

  let finish = (callback: DashboardInstanceCallbacksCreateOutput) => {
    onCreate?.(callback);
    close();
  };

  let create = async () => {
    if (!selectedConnection) return;
    let name = effectiveCallbackName.trim();
    if (!name) return;

    let callback = createdCallback;
    if (!callback) {
      let [result] = await createCallback.mutate({
        instanceId,
        name,
        providerDeploymentId: selectedConnection.deploymentId,
        triggers: selectedTriggerKeys.map(triggerId => ({ triggerId }))
      });
      if (!result) return;

      callback = result;
      setCreatedCallback(result);
    }

    let [callbackInstance] = await createCallbackInstance.mutate({
      instanceId,
      callbackId: callback.id,
      providerConfigId: selectedConnection.configId,
      providerAuthConfigId: selectedConnection.authConfigId ?? undefined
    });
    if (!callbackInstance) return;

    finish(callback);
  };

  let selectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedConnectionId(null);
    setConnectionSearch('');
    setCallbackName('');
    setNameTouched(false);
    setSelectedTriggerKeys([]);
    setTriggersTouched(false);
    setCreatedCallback(null);
    setCurrentStep(1);
  };

  let renderConnectionCard = (option: CallbackConnectionDisplayItem) => (
    <ConnectionCard
      key={option.id}
      type="button"
      $selected={option.id === selectedConnectionId}
      disabled={!!createdCallback}
      onClick={() => {
        setSelectedConnectionId(option.id);
        setCurrentStep(2);
      }}
    >
      <Flex direction="column" gap={3} style={{ minWidth: 0 }}>
        <Text size="2" weight="strong">
          {option.pathLabel}
        </Text>
        <Text size="1" color="gray600">
          {option.connectionLabel}
        </Text>
      </Flex>
      <ConnectionRadio $selected={option.id === selectedConnectionId} />
    </ConnectionCard>
  );

  let steps = [
    {
      title: 'Choose Provider',
      render: () => (
        <>
          <ProviderSelectionStep
            instanceId={instanceId}
            limit={30}
            emptyText="No providers with event support found."
            internalScrollHeight="calc(100vh - 350px)"
            prioritizeProvidersWithDeployments={false}
            selectedProviderId={selectedProviderId ?? undefined}
            providerListingsFilter={{
              capabilities: {
                supportsCallbacks: true
              }
            }}
            onSelect={selectProvider}
          />

          <Spacer height={20} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          </Dialog.Actions>
        </>
      )
    },
    {
      title: 'Choose Instance',
      render: () => {
        let isLoading = integrations.isLoading || integrationInstances.isLoading;
        let normalizedSearch = connectionSearch.trim().toLowerCase();
        let visibleOptions = normalizedSearch
          ? connectionOptions.filter(option =>
              `${option.pathLabel} ${option.connectionLabel}`
                .toLowerCase()
                .includes(normalizedSearch)
            )
          : connectionOptions;

        return (
          <FocusedStep>
            <Callout color="gray">
              A callback receives events from every instance attached to it. Choose the first{' '}
              {providerName} instance now; you can attach more after creating the callback.
            </Callout>

            <Spacer height={18} />

            {isLoading ? (
              <Callout color="gray">Looking for {providerName} instances...</Callout>
            ) : connectionOptions.length === 0 ? (
              <Callout color="orange">
                {providerName} is not used in any integration instance yet. Add {providerName}
                to an integration and create an instance for it — it will then show up here.
              </Callout>
            ) : (
              <>
                {connectionOptions.length > 6 && (
                  <>
                    <Input
                      label="Search instances"
                      hideLabel
                      size="2"
                      placeholder="Search instances..."
                      value={connectionSearch}
                      onChange={event => setConnectionSearch(event.target.value)}
                    />
                    <Spacer height={12} />
                  </>
                )}

                <ConnectionList>
                  {visibleOptions.length ? (
                    visibleOptions.map(renderConnectionCard)
                  ) : (
                    <Callout color="gray">No instances match your search.</Callout>
                  )}
                </ConnectionList>
              </>
            )}

            <Spacer height={20} />

            <Dialog.Actions>
              <Button
                type="button"
                variant="outline"
                disabled={!!createdCallback}
                onClick={() => setCurrentStep(0)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!selectedConnection}
                onClick={() => setCurrentStep(2)}
              >
                Continue
              </Button>
            </Dialog.Actions>
          </FocusedStep>
        );
      }
    },
    {
      title: 'Confirm & Create',
      render: () => (
        <FocusedStep>
          {selectedConnection && (
            <>
              <RecapCard>
                <Flex direction="column" gap={4}>
                  <Text size="2" weight="strong">
                    {providerName} — {selectedConnection.pathLabel}
                  </Text>
                  <Text size="1" color="gray600">
                    This instance ({selectedConnection.connectionLabel}) will be attached when
                    the callback is created. You can attach more {providerName}
                    instances later.
                  </Text>
                </Flex>
              </RecapCard>

              <Spacer height={18} />
            </>
          )}

          <Input
            label="Callback Name"
            description="Shown in the callbacks list so you can tell callbacks apart."
            value={effectiveCallbackName}
            disabled={!!createdCallback}
            onChange={event => {
              setNameTouched(true);
              setCallbackName(event.target.value);
            }}
          />

          <Spacer height={15} />

          {isTriggerListPending ? (
            <Callout color="gray">Loading available {providerName} triggers...</Callout>
          ) : availableTriggerItems.length ? (
            <CallbackCompactMultiSelect
              label="Events to Receive"
              description={`All ${providerName} triggers are selected by default. Narrow this down if you only care about specific events — you can change it anytime on the callback page.`}
              placeholder="Select triggers"
              value={selectedTriggerKeys}
              summary={triggerSelectionSummary}
              disabled={!!createdCallback}
              onChange={keys => {
                setTriggersTouched(true);
                setSelectedTriggerKeys(keys);
              }}
              items={availableTriggerItems}
            />
          ) : (
            <Callout color="orange">
              No triggers were discovered for this {providerName} deployment yet. You can still
              create the callback and attach triggers later from the callback page.
            </Callout>
          )}

          <createCallback.RenderError />
          <createCallbackInstance.RenderError />

          <Spacer height={20} />

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              disabled={!!createdCallback}
              onClick={() => setCurrentStep(1)}
            >
              Back
            </Button>
            <Button
              type="button"
              loading={createCallback.isLoading || createCallbackInstance.isLoading}
              disabled={
                !selectedConnection ||
                !effectiveCallbackName.trim() ||
                isTriggerListPending ||
                (availableTriggerItems.length > 0 && selectedTriggerKeys.length === 0)
              }
              onClick={create}
            >
              {createdCallback ? 'Finish Setup' : 'Create Callback'}
            </Button>
          </Dialog.Actions>
        </FocusedStep>
      )
    }
  ];

  return (
    <ProviderCreationPanelShell
      title="Create Callback"
      description="Pick a provider and the first instance to attach to this callback."
      steps={steps}
      currentStep={currentStep}
      setCurrentStep={step => {
        if (!createdCallback) setCurrentStep(step);
      }}
      isStepDisabled={step =>
        (step >= 1 && !selectedProviderId) || (step >= 2 && !selectedConnection)
      }
      getStepDisabledReason={step => {
        if (step >= 1 && !selectedProviderId) return 'Choose a provider first';
        if (step >= 2 && !selectedConnection) return 'Choose an instance first';
        return null;
      }}
    />
  );
};

export let showCallbackFormModal = (p: {
  instanceId: string;
  onCreate?: (callback: DashboardInstanceCallbacksCreateOutput) => void;
}) =>
  showCallbackProviderCreationPanel(({ close, setWidth }) => (
    <CallbackCreatePanelFlow
      instanceId={p.instanceId}
      close={close}
      setPanelWidth={setWidth}
      onCreate={p.onCreate}
    />
  ));

let CallbackTestEventModalContent = (p: {
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  close: () => void;
}) => {
  let sendTestEvent = useSendCallbackTestEvent();
  let [eventType, setEventType] = useState('dashboard.test');
  let [payload, setPayload] = useState('{\n  "test": true\n}');

  let submit = async () => {
    let normalizedEventType = eventType.trim();
    if (!normalizedEventType) {
      toast.error('Event type is required');
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      let value = JSON.parse(payload);
      if (!value || Array.isArray(value) || typeof value !== 'object') {
        toast.error('Payload must be a JSON object');
        return;
      }
      parsedPayload = value;
    } catch {
      toast.error('Payload must be valid JSON');
      return;
    }

    let [event, error] = await sendTestEvent.mutate({
      instanceId: p.instanceId,
      callbackId: p.callbackId,
      callbackInstanceId: p.callbackInstanceId,
      eventType: normalizedEventType,
      payload: parsedPayload
    });

    if (!event || error) return;
    toast.success('Synthetic callback event queued');
    p.close();
  };

  return (
    <>
      <Callout color="gray">
        This uses the authenticated dashboard API and records the event source as
        dashboard_test. It does not send an unsigned request to the public receiver URL.
      </Callout>

      <Spacer height={15} />

      <Input
        label="Event Type"
        value={eventType}
        onChange={event => setEventType(event.target.value)}
      />

      <Spacer height={15} />

      <Input
        label="JSON Payload"
        as="textarea"
        minRows={8}
        style={{ fontFamily: 'monospace' }}
        value={payload}
        onChange={event => setPayload(event.target.value)}
      />

      <sendTestEvent.RenderError />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          Cancel
        </Button>
        <Button type="button" loading={sendTestEvent.isLoading} onClick={submit}>
          Send Test Event
        </Button>
      </Dialog.Actions>
    </>
  );
};

export let showCallbackTestEventModal = (p: {
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={720}>
      <Dialog.Title>Send Test Event</Dialog.Title>
      <Dialog.Description>
        Queue an authenticated synthetic event for this instance.
      </Dialog.Description>

      <CallbackTestEventModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));

let secureReceiverUrl = (baseUrl: string, secret: string) =>
  `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(secret)}`;

let CallbackSecretSetupModalContent = (p: {
  mode: 'create' | 'rotate';
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverUrl: string;
  close: () => void;
  onComplete: () => void;
}) => {
  let createSecret = useCreateCallbackReceiverPathSecret();
  let rotateSecret = useRotateCallbackReceiverPathSecret();
  let [revealedUrl, setRevealedUrl] = useState<string | null>(null);

  let submit = async () => {
    let owner = {
      instanceId: p.instanceId,
      callbackId: p.callbackId,
      callbackInstanceId: p.callbackInstanceId
    };
    let [mutation, mutationError] =
      p.mode === 'create'
        ? await createSecret.mutate(owner)
        : await rotateSecret.mutate(owner);
    if (!mutation || mutationError) return;

    setRevealedUrl(mutation.webhookUrl ?? secureReceiverUrl(p.receiverUrl, mutation.value));
    p.onComplete();
  };

  let action = p.mode === 'create' ? 'Create and reveal once' : 'Rotate and reveal once';
  return (
    <>
      <Callout color={revealedUrl ? 'orange' : 'gray'}>
        {revealedUrl
          ? 'Copy this secured receiver URL now. Its generated secret cannot be read again after this dialog closes.'
          : p.mode === 'rotate'
            ? 'Rotation is immediate. The current URL stops working as soon as the new secured URL is created.'
            : 'Create the secured receiver URL when you are ready to copy it. The generated value is shown only once.'}
      </Callout>

      <Spacer height={15} />

      {revealedUrl ? (
        <>
          <Copy label="Secure callback URL" value={revealedUrl} />
          {p.mode === 'rotate' && (
            <>
              <Spacer height={10} />
              <Callout color="gray">
                The previous URL was revoked immediately and is no longer accepted.
              </Callout>
            </>
          )}
        </>
      ) : (
        <CallbackMaskedValue
          label="Secure callback URL preview"
          value={`${p.receiverUrl.replace(/\/$/, '')}/••••••••`}
        />
      )}

      <createSecret.RenderError />
      <rotateSecret.RenderError />

      <Spacer height={20} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          {revealedUrl ? 'Done' : 'Cancel'}
        </Button>
        {!revealedUrl && (
          <Button
            type="button"
            loading={createSecret.isLoading || rotateSecret.isLoading}
            onClick={submit}
          >
            {action}
          </Button>
        )}
      </Dialog.Actions>
    </>
  );
};

export let showCallbackSecretSetupModal = (p: {
  mode: 'create' | 'rotate';
  instanceId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverUrl: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={720}>
      <Dialog.Title>
        {p.mode === 'create' ? 'Create secure callback URL' : 'Rotate callback URL'}
      </Dialog.Title>
      <Dialog.Description>
        The generated value is returned once and is discarded when this dialog closes.
      </Dialog.Description>
      <CallbackSecretSetupModalContent {...p} close={close} />
    </Dialog.Wrapper>
  ));
