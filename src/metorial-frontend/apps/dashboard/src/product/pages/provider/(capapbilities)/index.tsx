import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { showModal } from '@metorial/ui';
import { ProviderToolsTable, type ProviderTool } from '../../../scenes/providers/toolsTable';
import { getJsonSchemaObject } from '../../../lib/jsonSchema';
import { useProviderVersionContext } from '../providerVersionContext';
import {
  CapabilityDetailsPanel,
  DetailList,
  DetailSection,
  MetadataStrip,
  SchemaSection,
  getSchemaFieldCount,
  type CapabilityMetadataBadge
} from './components/detailsPanel';

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
  let onViewDetails = (tool: ProviderTool) => {
    let modeBadges = getToolModeBadges(tool);

    let inputSchema = getJsonSchemaObject(tool.inputSchema);
    let outputSchema = getJsonSchemaObject(tool.outputSchema);
    let inputFieldCount = getSchemaFieldCount(inputSchema);
    let outputFieldCount = getSchemaFieldCount(outputSchema);

    let metadataBadges: CapabilityMetadataBadge[] = [
      ...modeBadges,
      ...tool.categoryLabels.map(category => ({
        label: category.label,
        color: 'blue' as const
      })),
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

  return renderWithLoader({ instance })(({ instance }) => (
    <ProviderToolsTable
      instanceId={instance.data.id}
      providerVersionId={selectedVersionId}
      onViewDetails={onViewDetails}
    />
  ));
};
