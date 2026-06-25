import { Button, Flex, Text } from '@metorial/ui';
import { CatalogTable } from '../components/catalogTable';
import { showCapabilityDetailsPanel } from '../components/capabilityDetailsPanel';
import type { OverviewSection } from '../types';
import {
  getMethodResult,
  getSchemaPropertyCount,
  getSchemaRequiredCount,
  pluralize
} from '../utils';

export let getToolsOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let tools = Array.isArray(result?.tools) ? result.tools : [];
  let visibleTools = tools.slice(0, 6);

  let rows = visibleTools.map((tool: any, index: number) => {
    let propertyCount = getSchemaPropertyCount(tool?.inputSchema);
    let requiredCount = getSchemaRequiredCount(tool?.inputSchema);
    let title = String(tool?.title ?? tool?.name ?? `Tool ${index + 1}`);
    let name = tool?.name ? String(tool.name) : null;

    let inputsLabel =
      propertyCount > 0 ? pluralize(propertyCount, 'input field') : 'No input fields';
    if (requiredCount > 0) {
      inputsLabel += ` (${pluralize(requiredCount, 'required')})`;
    }

    return [
      <div>
        <Text size="2" weight="strong">
          {title}
        </Text>
        {name && name !== title ? (
          <Text size="1" style={{ fontFamily: 'monospace' }} color="gray600">
            {name}
          </Text>
        ) : null}
      </div>,
      <Text size="2" color="gray700">
        {inputsLabel}
      </Text>,
      <Flex justify="end" style={{ width: '100%' }}>
        <Button
          size="1"
          variant="outline"
          onClick={() => showCapabilityDetailsPanel({ kind: 'tool', entity: tool })}
        >
          View Details
        </Button>
      </Flex>
    ];
  });

  return [
    {
      id: 'tools',
      content: (
        <CatalogTable
          emptyText="No tools were returned."
          headers={['Name', 'Inputs', '']}
          rows={rows}
          moreText={
            result?.nextCursor
              ? 'More tools are available through pagination.'
              : tools.length > visibleTools.length
                ? `Showing the first ${visibleTools.length} of ${tools.length} tools.`
                : null
          }
        />
      )
    }
  ];
};
