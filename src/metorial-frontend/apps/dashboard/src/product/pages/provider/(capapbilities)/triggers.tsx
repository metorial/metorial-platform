import type { DashboardInstanceProvidersTriggersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { col, createDataList, defineAction } from '@metorial/data-list';
import { useCurrentInstance, useProviderTriggers } from '@metorial/state';
import { Badge, showModal } from '@metorial/ui';
import { RiEyeLine } from '@remixicon/react';
import { getJsonSchemaObject } from '../../../lib/jsonSchema';
import { useProviderVersionContext } from '../providerVersionContext';
import {
  CapabilityDetailsPanel,
  DetailRows,
  DetailSection,
  MetadataStrip,
  SchemaSection,
  getSchemaFieldCount,
  type CapabilityMetadataBadge
} from './components/detailsPanel';

type ProviderTrigger = DashboardInstanceProvidersTriggersListOutput['items'][number];

let getInvocationBadge = (
  invocation: ProviderTrigger['invocation']
): { label: string; color: 'blue' | 'purple' } => {
  if (invocation.type === 'polling') {
    return { label: 'Polling', color: 'blue' };
  }

  return { label: 'Webhook', color: 'purple' };
};

let showTriggerDetails = (trigger: ProviderTrigger) => {
  let invocationBadge = getInvocationBadge(trigger.invocation);
  let inputSchema = getJsonSchemaObject(trigger.inputSchema);
  let outputSchema = getJsonSchemaObject(trigger.outputSchema);
  let inputFieldCount = getSchemaFieldCount(inputSchema);
  let outputFieldCount = getSchemaFieldCount(outputSchema);
  let invocationRows =
    trigger.invocation.type === 'polling'
      ? [
          { label: 'Type', value: 'Polling' },
          {
            label: 'Interval',
            value: `${trigger.invocation.intervalSeconds} seconds`
          }
        ]
      : [
          { label: 'Type', value: 'Webhook' },
          {
            label: 'Auto-registration',
            value: trigger.invocation.autoRegistration.status
          },
          {
            label: 'Auto-unregistration',
            value: trigger.invocation.autoUnregistration.status
          }
        ];
  let metadataBadges: CapabilityMetadataBadge[] = [
    invocationBadge,
    ...(trigger.invocation.type === 'polling'
      ? [
          {
            label: `${trigger.invocation.intervalSeconds}s interval`,
            color: 'gray' as const
          }
        ]
      : [
          {
            label: `Registration ${trigger.invocation.autoRegistration.status}`,
            color: 'gray' as const
          }
        ]),
    ...(inputFieldCount > 0
      ? [
          {
            label: `${inputFieldCount} input ${inputFieldCount === 1 ? 'field' : 'fields'}`,
            color: 'cyan' as const
          }
        ]
      : []),
    ...(outputFieldCount > 0
      ? [
          {
            label: `${outputFieldCount} output ${outputFieldCount === 1 ? 'field' : 'fields'}`,
            color: 'purple' as const
          }
        ]
      : [])
  ];

  showModal(({ dialogProps }) => (
    <CapabilityDetailsPanel
      dialogProps={dialogProps}
      title={trigger.name}
      description={trigger.description}
    >
      <MetadataStrip label="Key" value={trigger.key} badges={metadataBadges} />

      <DetailSection title="Invocation">
        <DetailRows rows={invocationRows} />
      </DetailSection>

      <SchemaSection title="Input Schema" schema={inputSchema} />
      <SchemaSection title="Output Schema" schema={outputSchema} />
    </CapabilityDetailsPanel>
  ));
};

let noTriggers: ProviderTrigger[] = [];

let ProviderTriggersList = createDataList<{
  instanceId: string;
  providerVersionId?: string;
}>('provider-triggers')
  .items(({ props }) => {
    let triggers = useProviderTriggers(
      props.instanceId,
      props.providerVersionId ? { providerVersionId: props.providerVersionId } : null
    );

    return {
      items: triggers.data?.items ?? noTriggers,
      isLoading: triggers.isLoading,
      error: triggers.error
    };
  })
  .columns([
    col.name<ProviderTrigger>({ description: false }),
    col.custom<ProviderTrigger>({
      id: 'mode',
      header: 'Mode',
      render: row => {
        let badge = getInvocationBadge(row.invocation);

        return (
          <Badge color={badge.color} size="2">
            {badge.label}
          </Badge>
        );
      }
    }),
    col.text<ProviderTrigger>({
      id: 'key',
      header: 'Key',
      isDefault: false,
      get: row => row.key
    })
  ])
  .clickable(row => showTriggerDetails(row))
  .itemActions([
    defineAction<ProviderTrigger>({
      id: 'view-details',
      label: 'View Details',
      icon: <RiEyeLine />,
      useRun: () => async row => showTriggerDetails(row)
    })
  ])
  .build();

export let ProviderTriggersPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderTriggersList
      instanceId={instance.data.id}
      providerVersionId={selectedVersionId}
      listVariant="embedded"
      emptyState="No triggers found for this provider."
    />
  ));
};
