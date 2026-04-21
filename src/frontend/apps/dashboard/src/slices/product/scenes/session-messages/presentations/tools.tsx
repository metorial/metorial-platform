import { RiToolsLine } from '@remixicon/react';
import { CatalogOverview } from '../components/catalogOverview';
import type { EntityDetail, OverviewSection } from '../types';
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
  let visibleTools = tools.slice(0, 6).map((tool: any, index: number) => {
    let propertyCount = getSchemaPropertyCount(tool.inputSchema);
    let requiredCount = getSchemaRequiredCount(tool.inputSchema);

    return {
      description: tool.description ? String(tool.description) : undefined,
      details: [
        tool.name ? { label: 'Name', value: String(tool.name) } : null,
        {
          label: 'Inputs',
          value:
            propertyCount > 0 ? pluralize(propertyCount, 'input field') : 'No input fields'
        },
        requiredCount > 0
          ? { label: 'Required', value: pluralize(requiredCount, 'required field') }
          : null,
        tool.execution?.taskSupport && tool.execution.taskSupport !== 'forbidden'
          ? {
              label: 'Task Support',
              value: String(tool.execution.taskSupport)
            }
          : null
      ].filter(Boolean) as EntityDetail[],
      id: String(tool.name ?? index),
      title: String(tool.title ?? tool.name ?? `Tool ${index + 1}`)
    };
  });

  return [
    {
      id: 'tools',
      content: (
        <CatalogOverview
          emptyText="No tools were returned."
          icon={<RiToolsLine />}
          items={visibleTools}
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
