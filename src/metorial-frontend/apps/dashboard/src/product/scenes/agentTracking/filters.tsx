import type { DashboardInstanceAgentTrackingFilterValuesListOutput } from '@metorial/dashboard-sdk';
import { useAgentTrackingFilterValues } from '@metorial/state';
import { createEntityFilter, type TableFilterEntityOption } from '@metorial/ui-product';
import { useMemo } from 'react';
import { getBrowserTimeZone, type AgentTrackingRangePreset } from './range';
import { modelLabel } from './sessionParts';

type FilterValue = DashboardInstanceAgentTrackingFilterValuesListOutput['items'][number];

type AgentTrackingFilterField = 'member' | 'model' | 'client';

let fieldCopy: Record<
  AgentTrackingFilterField,
  { id: string; label: string; noun: string; placeholder: string }
> = {
  member: {
    id: 'memberId',
    label: 'Member',
    noun: 'members',
    placeholder: 'Search members by name or email...'
  },
  model: {
    id: 'modelId',
    label: 'Model',
    noun: 'models',
    placeholder: 'Search models by name...'
  },
  client: {
    id: 'clientFamily',
    label: 'Client',
    noun: 'clients',
    placeholder: 'Search clients...'
  }
};

let filterValueOption = (
  field: AgentTrackingFilterField,
  value: FilterValue
): TableFilterEntityOption => {
  if (value.kind == 'unknown') {
    return { id: value.value, label: `Unknown ${fieldCopy[field].label}` };
  }

  if (value.member) {
    return {
      id: value.value,
      label: value.member.name ?? value.member.email ?? value.value,
      description: value.member.name ? (value.member.email ?? undefined) : undefined
    };
  }

  if (value.client) {
    return { id: value.value, label: value.client.name ?? value.value };
  }

  return {
    id: value.value,
    label: value.model ? modelLabel(value.model) : value.value,
    description: value.model?.name ? value.value : undefined
  };
};

let useFilterOptions = (
  instanceId: string | undefined,
  d: {
    field: AgentTrackingFilterField;
    range: AgentTrackingRangePreset;
    search?: string;
    values?: string[];
  }
) => {
  let values = useAgentTrackingFilterValues(instanceId, {
    field: d.field,
    search: d.search || undefined,
    value: d.values,
    range: d.range,
    timeZone: getBrowserTimeZone()
  });
  let data = values.data;

  let items = useMemo(
    () => (data?.items ?? []).map(value => filterValueOption(d.field, value)),
    [data]
  );

  return { items, isLoading: values.isLoading };
};

type FilterScope = { range: AgentTrackingRangePreset; rangeText: string };

let agentTrackingFilter = (
  instanceId: string | undefined,
  field: AgentTrackingFilterField,
  scope: FilterScope
) => {
  let copy = fieldCopy[field];
  let remoteSearch = field != 'client';

  return createEntityFilter({
    id: copy.id,
    label: copy.label,
    remoteSearch,
    searchPlaceholder: copy.placeholder,
    useSearch: ({ search }) => {
      let query = search.trim();
      let options = useFilterOptions(instanceId, {
        field,
        range: scope.range,
        search: remoteSearch ? query : undefined
      });

      return {
        items: options.items,
        isLoading: options.isLoading,
        empty: query
          ? `No matching ${copy.noun} in ${scope.rangeText}.`
          : `No ${copy.noun} sent usage in ${scope.rangeText}.`
      };
    },
    useByIds: ids => {
      let options = useFilterOptions(ids.length ? instanceId : undefined, {
        field,
        range: scope.range,
        values: ids
      });

      return useMemo(
        () => options.items.filter(item => ids.includes(item.id)),
        [options.items, ids.join(',')]
      );
    }
  });
};

export let agentTrackingFilters = <Field extends AgentTrackingFilterField>(
  instanceId: string | undefined,
  scope: FilterScope,
  fields: Field[]
) =>
  Object.fromEntries(
    fields.map(field => [field, agentTrackingFilter(instanceId, field, scope)])
  ) as Record<Field, ReturnType<typeof agentTrackingFilter>>;
