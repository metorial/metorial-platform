import { DashboardInstanceProvidersToolsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderTools } from '@metorial/state';
import { Badge, Button, Flex, Text, showModal } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { getJsonSchemaObject } from '../../../lib/jsonSchema';
import { useProviderVersionContext } from '../_layout';
import {
  CapabilityDetailsPanel,
  DetailList,
  DetailSection,
  MetadataStrip,
  SchemaSection,
  getSchemaFieldCount,
  type CapabilityMetadataBadge
} from './components/detailsPanel';

type ProviderTool = DashboardInstanceProvidersToolsListOutput['items'][number];
type ToolModeBadge = CapabilityMetadataBadge;

let getToolModeBadges = (tool: Pick<ProviderTool, 'tags'>) => {
  let badges: ToolModeBadge[] = [];

  if (tool.tags?.destructive) {
    badges.push({ label: 'Destructive', color: 'red' });
  }

  if (tool.tags?.readOnly) {
    badges.push({ label: 'Read-only', color: 'green' });
  }

  return badges;
};

export let ProviderToolsPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();
  let tools = useProviderTools(
    instance.data?.id,
    selectedVersionId ? { providerVersionId: selectedVersionId } : null
  );

  let onViewDetails = (tool: ProviderTool) => {
    let modeBadges = getToolModeBadges(tool);
    let inputSchema = getJsonSchemaObject(tool.inputSchema);
    let outputSchema = getJsonSchemaObject(tool.outputSchema);
    let inputFieldCount = getSchemaFieldCount(inputSchema);
    let outputFieldCount = getSchemaFieldCount(outputSchema);
    let metadataBadges: CapabilityMetadataBadge[] = [
      ...modeBadges,
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
        title={tool.name}
        description={tool.description}
      >
        <MetadataStrip label="Key" value={tool.key} badges={metadataBadges} />

        {(tool.instructions?.length ?? 0) > 0 && (
          <DetailSection title="Instructions">
            <DetailList items={tool.instructions ?? []} />
          </DetailSection>
        )}

        {(tool.constraints?.length ?? 0) > 0 && (
          <DetailSection title="Constraints">
            <DetailList items={tool.constraints ?? []} />
          </DetailSection>
        )}

        <SchemaSection title="Input Schema" schema={inputSchema} />
        <SchemaSection title="Output Schema" schema={outputSchema} />
      </CapabilityDetailsPanel>
    ));
  };

  let toolsContent = renderWithLoader({ tools })(({ tools }) => (
    <>
      <Table
        headers={['Name', 'Type', '']}
        data={tools.data.items.map(tool => {
          let modeBadges = getToolModeBadges(tool);
          let description =
            tool.description && tool.description.length > 110
              ? `${tool.description.slice(0, 110)}...`
              : (tool.description ?? '');

          return {
            data: [
              <Flex direction="column" gap={2}>
                <Text size="2" weight="strong">
                  {tool.name}
                </Text>
              </Flex>,
              <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {modeBadges.length > 0 ? (
                  modeBadges.map(modeBadge => (
                    <Badge key={modeBadge.label} color={modeBadge.color} size="1">
                      {modeBadge.label}
                    </Badge>
                  ))
                ) : (
                  <Badge color="gray" size="1">
                    Default
                  </Badge>
                )}
              </Flex>,
              <Flex justify="end" style={{ width: '100%' }}>
                <Button size="1" variant="outline" onClick={() => onViewDetails(tool)}>
                  View Details
                </Button>
              </Flex>
            ]
          };
        })}
      />

      {tools.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No tools found for this provider.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(() => toolsContent);
};
