import type { DashboardInstanceProvidersTriggersListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTriggers } from '@metorial/state';
import { Badge, Button, Flex, Text, showModal } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
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

export let ProviderTriggersPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();
  let triggers = useProviderTriggers(
    instance.data?.id,
    selectedVersionId ? { providerVersionId: selectedVersionId } : null
  );

  let onViewDetails = (trigger: ProviderTrigger) => {
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
              label: `${outputFieldCount} output ${
                outputFieldCount === 1 ? 'field' : 'fields'
              }`,
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

  let triggersContent = renderWithLoader({ triggers })(({ triggers }) => (
    <>
      <Table
        headers={['Name', 'Mode', '']}
        data={triggers.data.items.map(trigger => {
          let description =
            trigger.description && trigger.description.length > 110
              ? `${trigger.description.slice(0, 110)}...`
              : (trigger.description ?? '');
          let invocationBadge = getInvocationBadge(trigger.invocation);

          return {
            data: [
              <Flex direction="column" gap={2}>
                <Text size="2" weight="strong">
                  {trigger.name}
                </Text>
              </Flex>,
              <Badge color={invocationBadge.color} size="1">
                {invocationBadge.label}
              </Badge>,
              <Flex justify="end" style={{ width: '100%' }}>
                <Button size="1" variant="outline" onClick={() => onViewDetails(trigger)}>
                  View Details
                </Button>
              </Flex>
            ]
          };
        })}
      />

      {triggers.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No triggers found for this provider.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(() => triggersContent);
};
