import type {
  DashboardInstanceIntegrationsProvidersCallbackGetOutput,
  DashboardInstanceProvidersTriggersListOutput
} from '@metorial/dashboard-sdk';
import {
  useIntegrationProviderCallback,
  useIntegrationProviderCallbackConfigSchema,
  useWebhookDestinations
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Flex,
  Input,
  Panel,
  Spacer,
  Text,
  showModal,
  toast
} from '@metorial/ui';
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { getJsonSchemaObject } from '../../lib/jsonSchema';
import { CallbackCompactMultiSelect } from './callbackFields';
import {
  buildIntegrationProviderCallbackInput,
  getCallbackConfigMissingKeys,
  getMissingRequiredCallbackConfigKeys,
  isCallbackConfigSchemaRequestPending
} from './integrationCallbackLogic';
import { showWebhookDestinationFormModal } from './integrationDestinationModal';

type ProviderTrigger = DashboardInstanceProvidersTriggersListOutput['items'][number];
type IntegrationProviderCallback = DashboardInstanceIntegrationsProvidersCallbackGetOutput;

let CHILD_DIALOG_TEARDOWN_DELAY_MS = 500;

let PanelMarker = styled.div`
  display: contents;
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let getDialogZIndex = (dialog: Element) => {
  let zIndex = Number.parseInt(getComputedStyle(dialog).zIndex, 10);
  return Number.isNaN(zIndex) ? null : zIndex;
};

let isDialogAbove = (panelDialog: Element, candidate: Element) => {
  if (candidate === panelDialog || panelDialog.contains(candidate)) return false;

  let panelZIndex = getDialogZIndex(panelDialog);
  let candidateZIndex = getDialogZIndex(candidate);

  if (panelZIndex != null && candidateZIndex != null && panelZIndex !== candidateZIndex) {
    return candidateZIndex > panelZIndex;
  }

  return !!(panelDialog.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING);
};

let usePanelDismissGuard = (isOpen: boolean) => {
  let [marker, setMarker] = useState<HTMLDivElement | null>(null);
  let childDialogPresentRef = useRef(false);
  let dismissBlockedRef = useRef(false);
  let teardownDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let panelDialog = marker?.closest('[role="dialog"]');
    if (!panelDialog) return;

    let update = () => {
      let hasChildDialog = Array.from(document.querySelectorAll('[role="dialog"]')).some(
        candidate => isDialogAbove(panelDialog, candidate)
      );

      if (hasChildDialog) {
        childDialogPresentRef.current = true;
        dismissBlockedRef.current = true;
        if (teardownDelayRef.current) clearTimeout(teardownDelayRef.current);
        teardownDelayRef.current = null;
        return;
      }

      if (!childDialogPresentRef.current) return;
      childDialogPresentRef.current = false;
      teardownDelayRef.current = setTimeout(() => {
        dismissBlockedRef.current = false;
        teardownDelayRef.current = null;
      }, CHILD_DIALOG_TEARDOWN_DELAY_MS);
    };

    let observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'style', 'data-state']
    });
    update();

    return () => {
      observer.disconnect();
      if (teardownDelayRef.current) clearTimeout(teardownDelayRef.current);
      teardownDelayRef.current = null;
      childDialogPresentRef.current = false;
      dismissBlockedRef.current = false;
    };
  }, [isOpen, marker]);

  return {
    markerRef: setMarker,
    shouldBlockDismiss: () => dismissBlockedRef.current
  };
};

type IntegrationCallbackPanelWrapperProps = ComponentProps<typeof Panel.Wrapper>;

export let IntegrationCallbackPanelWrapper = ({
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  ...panelProps
}: IntegrationCallbackPanelWrapperProps) => {
  let { markerRef, shouldBlockDismiss } = usePanelDismissGuard(panelProps.isOpen);

  return (
    <Panel.Wrapper
      {...panelProps}
      onEscapeKeyDown={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onEscapeKeyDown?.(event);
      }}
      onPointerDownOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onPointerDownOutside?.(event);
      }}
      onInteractOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onInteractOutside?.(event);
      }}
      onFocusOutside={event => {
        if (shouldBlockDismiss()) event.preventDefault();
        onFocusOutside?.(event);
      }}
    >
      <PanelMarker ref={markerRef}>{children}</PanelMarker>
    </Panel.Wrapper>
  );
};

let getEventTypes = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((eventType): eventType is string => typeof eventType === 'string')
    : [];

let showTriggerEventTypesModal = (p: {
  trigger: ProviderTrigger;
  selectedEventTypes: readonly string[];
  onSave: (eventTypes: string[]) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let availableEventTypes = getEventTypes(p.trigger.eventTypes);
    let [eventTypes, setEventTypes] = useState(
      p.selectedEventTypes.length ? [...p.selectedEventTypes] : availableEventTypes
    );
    let hasSelection = eventTypes.length > 0;

    return (
      <Dialog.Wrapper {...dialogProps} width={600}>
        <Dialog.Title>{p.trigger.name} event types</Dialog.Title>
        <Dialog.Description>
          Choose which event types should reach this callback. All are selected by default.
        </Dialog.Description>

        {availableEventTypes.length ? (
          <CallbackCompactMultiSelect
            label="Event types"
            value={eventTypes}
            onChange={setEventTypes}
            placeholder="Select event types"
            summary={`${eventTypes.length} of ${availableEventTypes.length} selected`}
            items={availableEventTypes.map(eventType => ({ id: eventType, label: eventType }))}
            error={!hasSelection && 'Select at least one event type'}
          />
        ) : (
          <Callout color="gray">
            This trigger publishes all events without a typed filter.
          </Callout>
        )}

        <Spacer height={20} />
        <Dialog.Actions>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={availableEventTypes.length > 0 && !hasSelection}
            onClick={() => {
              p.onSave(eventTypes.length === availableEventTypes.length ? [] : eventTypes);
              close();
            }}
          >
            Save event types
          </Button>
        </Dialog.Actions>
      </Dialog.Wrapper>
    );
  });

let IntegrationProviderCallbackPanelContent = (p: {
  instanceId: string;
  integrationProviderId: string;
  providerName: string;
  triggers: readonly ProviderTrigger[];
  callback: IntegrationProviderCallback | null;
  close: () => void;
  onComplete: () => void;
}) => {
  let callbackLoader = useIntegrationProviderCallback(p.instanceId, p.integrationProviderId);
  let upsert = callbackLoader.useUpsertMutator();
  let destinations = useWebhookDestinations(p.instanceId, { limit: 100, order: 'desc' });
  let initialTriggerIds =
    p.callback?.providerTriggers.map(trigger => trigger.providerTrigger.key) ?? [];
  let initialEventTypes = Object.fromEntries(
    (p.callback?.providerTriggers ?? []).map(trigger => [
      trigger.providerTrigger.key,
      trigger.eventTypes
    ])
  );
  let [selectedTriggerIds, setSelectedTriggerIds] = useState<string[]>(initialTriggerIds);
  let [eventTypesByTrigger, setEventTypesByTrigger] =
    useState<Record<string, string[]>>(initialEventTypes);
  let [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>(
    p.callback?.destinations.map(destination => destination.id) ?? []
  );
  let [configValues, setConfigValues] = useState<Record<string, string>>({});
  let [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  let [triggerError, setTriggerError] = useState<string | null>(null);
  let configSchema = useIntegrationProviderCallbackConfigSchema(
    p.instanceId,
    p.integrationProviderId,
    selectedTriggerIds
  );
  let schema = getJsonSchemaObject(configSchema.data?.schema);
  let configuredKeys = new Set(p.callback?.config?.configuredKeys ?? []);
  let requiredKeys = schema?.required ?? [];
  let schemaProperties = Object.entries(schema?.properties ?? {}).flatMap(([key, property]) =>
    property && typeof property === 'object' ? ([[key, property]] as const) : []
  );
  let destinationItems = [
    ...(p.callback?.destinations ?? []),
    ...(destinations.data?.items ?? [])
  ].filter(
    (destination, index, items) =>
      items.findIndex(candidate => candidate.id === destination.id) === index
  );
  let isConfigSchemaPending = isCallbackConfigSchemaRequestPending(
    selectedTriggerIds,
    configSchema.isLoading
  );
  let isConfigSchemaUnavailable = selectedTriggerIds.length > 0 && Boolean(configSchema.error);

  let submit = async () => {
    setTriggerError(null);
    setConfigErrors({});

    if (!selectedTriggerIds.length) {
      setTriggerError('Select at least one trigger. Use Disable to remove the callback.');
      return;
    }

    let missingRequiredKeys = getMissingRequiredCallbackConfigKeys({
      requiredKeys,
      configuredKeys: [...configuredKeys],
      configValues
    });
    if (missingRequiredKeys.length) {
      setConfigErrors(
        Object.fromEntries(
          missingRequiredKeys.map(key => [key, 'Enter a value before saving'])
        )
      );
      return;
    }

    let [result, error] = await upsert.mutate(
      buildIntegrationProviderCallbackInput({
        selectedTriggerIds,
        eventTypesByTrigger,
        destinationIds: selectedDestinationIds,
        configValues
      })
    );

    if (error) {
      let missingKeys = getCallbackConfigMissingKeys(error);
      if (missingKeys) {
        setConfigErrors(
          Object.fromEntries(
            missingKeys.map(key => [key, 'This value is required for the selected triggers'])
          )
        );
      }
      return;
    }

    if (!result) return;
    toast.success(p.callback ? 'Callback updated' : 'Callback enabled');
    p.onComplete();
    p.close();
  };

  return (
    <>
      <Panel.Header>
        <Panel.Title>{p.callback ? 'Edit callback' : 'Set up triggers'}</Panel.Title>
        <Panel.Description>
          Configure callback triggers and destinations for {p.providerName}.
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <Section>
          <Flex direction="column" gap={3}>
            <Text size="2" weight="strong">
              1. Triggers
            </Text>
            <Text size="2" color="gray600">
              Select at least one provider trigger. Configure event types per trigger when
              needed.
            </Text>
          </Flex>

          <CallbackCompactMultiSelect
            label="Triggers"
            value={selectedTriggerIds}
            onChange={value => {
              setSelectedTriggerIds(value);
              setTriggerError(null);
              setConfigErrors({});
            }}
            placeholder="Select provider triggers"
            summary={`${selectedTriggerIds.length} selected`}
            items={p.triggers.map(trigger => ({ id: trigger.key, label: trigger.name }))}
            error={triggerError ?? false}
          />

          {isConfigSchemaPending ? (
            <Callout color="gray">Loading callback configuration requirements...</Callout>
          ) : null}

          {isConfigSchemaUnavailable ? (
            <Callout color="red">
              <Flex align="center" justify="space-between" gap={10}>
                <Text size="2">Unable to load callback configuration requirements.</Text>
                <Button size="1" variant="outline" onClick={configSchema.refetch}>
                  Retry
                </Button>
              </Flex>
            </Callout>
          ) : null}

          {selectedTriggerIds.map(triggerId => {
            let trigger = p.triggers.find(candidate => candidate.key === triggerId);
            if (!trigger) return null;
            let selectedEventTypes = eventTypesByTrigger[triggerId] ?? [];
            return (
              <Flex key={triggerId} justify="space-between" align="center" gap={10}>
                <Flex direction="column" gap={2}>
                  <Text size="2" weight="strong">
                    {trigger.name}
                  </Text>
                  <Text size="1" color="gray600">
                    {selectedEventTypes.length
                      ? `${selectedEventTypes.length} event types selected`
                      : 'All event types'}
                  </Text>
                </Flex>
                <Button
                  size="1"
                  variant="outline"
                  onClick={() =>
                    showTriggerEventTypesModal({
                      trigger,
                      selectedEventTypes,
                      onSave: eventTypes =>
                        setEventTypesByTrigger(current => ({
                          ...current,
                          [triggerId]: eventTypes
                        }))
                    })
                  }
                >
                  Configure events
                </Button>
              </Flex>
            );
          })}
        </Section>

        {schema ? (
          <>
            <Spacer height={24} />
            <Section>
              <Flex direction="column" gap={3}>
                <Text size="2" weight="strong">
                  2. Callback configuration
                </Text>
                <Text size="2" color="gray600">
                  Secret values are write-only. Leave a configured field blank to keep its
                  current value.
                </Text>
              </Flex>

              {schemaProperties.map(([key, property]) => {
                let isConfigured = configuredKeys.has(key);
                let isRequired = requiredKeys.includes(key) && !isConfigured;
                return (
                  <div key={key}>
                    <Flex align="center" gap={6}>
                      <Text size="2" weight="strong">
                        {typeof property.title === 'string' ? property.title : key}
                      </Text>
                      {isConfigured ? <Badge color="green">Configured</Badge> : null}
                    </Flex>
                    <Input
                      label={key}
                      hideLabel
                      type="password"
                      autoComplete="new-password"
                      required={isRequired}
                      placeholder={
                        isConfigured ? 'Optional replacement value' : 'Enter secret value'
                      }
                      value={configValues[key] ?? ''}
                      error={configErrors[key]}
                      onChange={event => {
                        let value = event.target.value;
                        setConfigValues(current => ({ ...current, [key]: value }));
                        setConfigErrors(current => ({ ...current, [key]: '' }));
                      }}
                    />
                    {typeof property.description === 'string' ? (
                      <Text size="1" color="gray600">
                        {property.description}
                      </Text>
                    ) : null}
                  </div>
                );
              })}
            </Section>
          </>
        ) : null}

        <Spacer height={24} />
        <Section>
          <Flex direction="column" gap={3}>
            <Text size="2" weight="strong">
              {schema ? '3' : '2'}. Destinations
            </Text>
            <Text size="2" color="gray600">
              Link the webhook destinations that should receive events from this callback.
            </Text>
          </Flex>

          <CallbackCompactMultiSelect
            label="Webhook destinations"
            value={selectedDestinationIds}
            onChange={setSelectedDestinationIds}
            placeholder="Select destinations"
            summary={`${selectedDestinationIds.length} selected`}
            items={destinationItems.map(destination => ({
              id: destination.id,
              label: destination.name
            }))}
          />

          {destinations.data?.pagination.hasMoreBefore ||
          destinations.data?.pagination.hasMoreAfter ? (
            <Flex align="center" justify="space-between" gap={8}>
              <Text size="1" color="gray600">
                Browse destination pages without losing the current selection.
              </Text>
              <Flex gap={6}>
                <Button
                  type="button"
                  size="1"
                  variant="outline"
                  disabled={!destinations.data.pagination.hasMoreBefore}
                  onClick={destinations.previous}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="1"
                  variant="outline"
                  disabled={!destinations.data.pagination.hasMoreAfter}
                  onClick={destinations.next}
                >
                  Next
                </Button>
              </Flex>
            </Flex>
          ) : null}

          <Flex justify="end">
            <Button
              type="button"
              size="1"
              variant="outline"
              onClick={() =>
                showWebhookDestinationFormModal({
                  instanceId: p.instanceId,
                  onComplete: async destination => {
                    setSelectedDestinationIds(current => [
                      ...new Set([...current, destination.id])
                    ]);
                    await destinations.refetch();
                  }
                })
              }
            >
              New destination
            </Button>
          </Flex>
        </Section>

        <upsert.RenderError />

        <Spacer height={24} />
        <Panel.Actions>
          <Button type="button" variant="outline" onClick={p.close}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={upsert.isLoading}
            disabled={isConfigSchemaPending || isConfigSchemaUnavailable}
            onClick={submit}
          >
            {p.callback ? 'Save callback' : 'Enable callback'}
          </Button>
        </Panel.Actions>
      </Panel.Content>
    </>
  );
};

export let showIntegrationProviderCallbackPanel = (p: {
  instanceId: string;
  integrationProviderId: string;
  providerName: string;
  triggers: readonly ProviderTrigger[];
  callback: IntegrationProviderCallback | null;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <IntegrationCallbackPanelWrapper {...dialogProps} width={680}>
      <IntegrationProviderCallbackPanelContent {...p} close={close} />
    </IntegrationCallbackPanelWrapper>
  ));
