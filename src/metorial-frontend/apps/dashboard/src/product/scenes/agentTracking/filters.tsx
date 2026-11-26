import type {
  DashboardInstanceAgentTrackingFilterValuesListOutput,
  DashboardInstanceAgentTrackingFilterValuesListQuery
} from '@metorial/dashboard-sdk';
import { useAgentTrackingFilterValues } from '@metorial/state';
import type { TableFilterEntityOption } from '@metorial/ui-product';
import { createContext, useContext } from 'react';
import { defineEntityFilter, useEntityList, type EntityDefinition } from '../entityFilters';
import {
  defaultAgentTrackingRange,
  getBrowserTimeZone,
  type AgentTrackingRangePreset
} from './range';
import { repositoryLabel } from './sessionContext';
import { modelLabel } from './spendSummary';

type FilterValue = DashboardInstanceAgentTrackingFilterValuesListOutput['items'][number];

export let AgentTrackingFilterRangeContext = createContext<AgentTrackingRangePreset>(
  defaultAgentTrackingRange
);

let filterValueOption =
  (label: string) =>
  (value: FilterValue): TableFilterEntityOption => {
    if (value.kind == 'unknown') return { id: value.value, label: `Unknown ${label}` };

    if (value.member) {
      return {
        id: value.value,
        label: value.member.name ?? value.member.email ?? value.value,
        description: value.member.name ? (value.member.email ?? undefined) : undefined
      };
    }

    if (value.client) return { id: value.value, label: value.client.name ?? value.value };

    if (value.repository) {
      return {
        id: value.value,
        label: repositoryLabel(value.repository),
        description: value.repository.host ?? undefined
      };
    }

    return {
      id: value.value,
      label: value.model ? modelLabel(value.model) : value.value,
      description: value.model?.name ? value.value : undefined
    };
  };

let filterValuesFilter =
  (
    field: DashboardInstanceAgentTrackingFilterValuesListQuery['field'],
    d: Pick<EntityDefinition, 'id' | 'label' | 'noun' | 'mode'>
  ) =>
  (instanceId: string | undefined, rangeText = 'this range') =>
    defineEntityFilter({
      ...d,
      emptyMessage: search =>
        search
          ? `No matching ${d.noun} in ${rangeText}.`
          : `No ${d.noun} sent usage in ${rangeText}.`,
      useList: q => {
        let range = useContext(AgentTrackingFilterRangeContext);
        let values = useAgentTrackingFilterValues(
          instanceId,
          q
            ? { field, search: q.search, value: q.ids, range, timeZone: getBrowserTimeZone() }
            : null
        );

        return useEntityList(values, filterValueOption(d.label));
      }
    })();

export let agentTrackingFilters = {
  member: filterValuesFilter('member', {
    id: 'memberId',
    label: 'Member',
    noun: 'members',
    mode: 'search'
  }),
  model: filterValuesFilter('model', {
    id: 'modelId',
    label: 'Model',
    noun: 'models',
    mode: 'search'
  }),
  client: filterValuesFilter('client', {
    id: 'clientFamily',
    label: 'Client',
    noun: 'clients',
    mode: 'recent'
  }),
  seat: filterValuesFilter('seat', {
    id: 'seat',
    label: 'Seat',
    noun: 'seats',
    mode: 'recent'
  }),
  repository: filterValuesFilter('repository', {
    id: 'repositoryId',
    label: 'Repository',
    noun: 'repositories',
    mode: 'search'
  }),
  branch: filterValuesFilter('branch', {
    id: 'branch',
    label: 'Branch',
    noun: 'branches',
    mode: 'search'
  }),
  ticket: filterValuesFilter('ticket', {
    id: 'ticket',
    label: 'Ticket',
    noun: 'tickets',
    mode: 'search'
  })
};
