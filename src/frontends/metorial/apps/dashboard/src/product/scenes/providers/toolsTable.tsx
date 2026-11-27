import type { DashboardInstanceProvidersToolsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction, EmptyValue } from '@metorial/data-list';
import { useProviderToolCategories, useProviderTools } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { RiEyeLine } from '@remixicon/react';
import { useMemo } from 'react';

export type ProviderTool = DashboardInstanceProvidersToolsListOutput['items'][number] & {
  categoryLabels: { key: string; label: string }[];
};

type ToolRow = ProviderTool;

let noTools: DashboardInstanceProvidersToolsListOutput['items'] = [];

type ToolsTableProps = {
  instanceId: string;
  providerVersionId?: string;
  onViewDetails?: (tool: ProviderTool) => void;
};

let ProviderToolsList = createDataList<ToolsTableProps>('provider-tools')
  .items(({ props }) => {
    let tools = useProviderTools(
      props.instanceId,
      props.providerVersionId ? { providerVersionId: props.providerVersionId } : null
    );

    return {
      items: tools.data?.items ?? noTools,
      isLoading: tools.isLoading,
      error: tools.error
    };
  })
  .enrich((items, { props }) => {
    let categories = useProviderToolCategories(props.instanceId, items);

    let enriched = useMemo(() => {
      let names = new Map(
        (categories.getCategories(items) ?? []).map(category => [category.key, category.name])
      );

      return items.map(tool => ({
        ...tool,
        categoryLabels: tool.toolCategoryKeys.map(key => ({
          key,
          label: names.get(key) ?? key
        }))
      }));
    }, [items, categories]);

    return { items: enriched, isLoading: categories.isLoading };
  })
  .columns([
    col.name<ToolRow>({ description: false }),
    col.custom<ToolRow>({
      id: 'type',
      header: 'Type',
      render: row => {
        let badges = [
          ...(row.tags?.destructive ? [{ label: 'Destructive', color: 'red' as const }] : []),
          ...(row.tags?.readOnly ? [{ label: 'Read-only', color: 'green' as const }] : [])
        ];

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {badges.length > 0 ? (
              badges.map(badge => (
                <Badge key={badge.label} color={badge.color} size="2">
                  {badge.label}
                </Badge>
              ))
            ) : (
              <Badge color="gray" size="2">
                Default
              </Badge>
            )}
          </div>
        );
      }
    }),
    col.custom<ToolRow>({
      id: 'categories',
      header: 'Categories',
      render: row =>
        row.categoryLabels.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.categoryLabels.map(category => (
              <Badge key={category.key} color="blue" size="2">
                {category.label}
              </Badge>
            ))}
          </div>
        ) : (
          <EmptyValue />
        )
    }),
    col.text<ToolRow>({
      id: 'key',
      header: 'Key',
      isDefault: false,
      get: row => row.key
    })
  ])
  .clickable((row, props) => props.onViewDetails?.(row))
  .itemActions([
    defineAction<ToolRow, ToolsTableProps>({
      id: 'view-details',
      label: 'View Details',
      icon: <RiEyeLine />,
      useRun:
        ({ props }) =>
        async row =>
          props.onViewDetails?.(row)
    })
  ])
  .build();

export let ProviderToolsTable = (p: ToolsTableProps) => (
  <ProviderToolsList
    {...p}
    listVariant="embedded"
    emptyState="No tools found for this provider."
  />
);
