import { Flex, OptionToggle, Select, Switch, Text } from '@metorial/ui';
import {
  FilterToolbar,
  getListValue,
  toFilterFieldNames,
  type FilterStateTuple,
  type TableFilterState
} from '@metorial/ui-product';
import { useMemo } from 'react';
import { CommitNumberInput } from '../commitInput';
import { AgentTrackingFilterRangeContext, agentTrackingFilters } from '../filters';
import { memberWindowDays } from '../memberParts';
import {
  agentTrackingRangePresets,
  defaultAgentTrackingRange,
  type AgentTrackingRangePreset
} from '../range';
import {
  maxSeatUsageDollars,
  teamViewDefinitions,
  type InsightsSort,
  type SortOrder,
  type TeamViewField,
  type TeamViewParams,
  type TeamViewState
} from './definitions';
import {
  dollarsToMicros,
  fractionToPercent,
  microsToDollars,
  percentToFraction
} from './state';

let filterRangeText = 'this range';

let shareThresholds = [
  { field: 'modelShareMin', label: 'Flag at or Above' },
  { field: 'highEffortShareMin', label: 'High Effort at or Above' },
  { field: 'fastShareMin', label: 'Fast Mode at or Above' },
  { field: 'outdatedShareMin', label: 'Outdated Models at or Above' },
  { field: 'cacheHitRateMax', label: 'Cache Hit Rate Below' }
] as const;

let orderItems = (sort: InsightsSort | undefined) =>
  sort == 'last_activity'
    ? [
        { id: 'desc', label: 'Most Recent First' },
        { id: 'asc', label: 'Least Recent First' }
      ]
    : [
        { id: 'desc', label: 'Highest First' },
        { id: 'asc', label: 'Lowest First' }
      ];

let ThresholdInput = (p: {
  label: string;
  unit: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
}) => (
  <CommitNumberInput
    {...p}
    size="2"
    min={0}
    step={1}
    format={{ maximumFractionDigits: 2 }}
    style={{ width: 190 }}
  />
);

let EntityPicker = ({
  instanceId,
  field,
  range,
  value,
  latest,
  onChange
}: {
  instanceId: string;
  field: 'model' | 'seat';
  range: AgentTrackingRangePreset;
  value: string[];
  latest: () => string[];
  onChange: (value: string[]) => void;
}) => {
  let filter = useMemo(
    () => agentTrackingFilters[field](instanceId, filterRangeText),
    [instanceId, field]
  );

  let toState = (values: string[]): TableFilterState[] =>
    values.length
      ? [
          {
            id: filter.id,
            fields: toFilterFieldNames(filter.fields),
            type: 'entity',
            operation: 'eq',
            value: values
          }
        ]
      : [];

  let setState: FilterStateTuple[1] = action => {
    let next = typeof action == 'function' ? action(toState(latest())) : action;
    onChange(getListValue(next.find(item => item.id == filter.id)));
  };

  return (
    <AgentTrackingFilterRangeContext.Provider value={range}>
      <FilterToolbar
        filters={[filter]}
        filterState={[toState(value), setState]}
        size="2"
        placeholder={field == 'model' ? 'Choose models...' : 'Only consider these seats...'}
      />
    </AgentTrackingFilterRangeContext.Provider>
  );
};

export let TeamViewControls = ({
  instanceId,
  view,
  current,
  onPatch
}: {
  instanceId: string;
  view: TeamViewState;
  current: () => { state: TeamViewState };
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let definition = teamViewDefinitions[view.kind];
  let params = view.params;
  let range = params.range ?? defaultAgentTrackingRange;
  let has = (field: TeamViewField) => definition.fields.includes(field);

  let thresholds = shareThresholds.filter(item => has(item.field));

  return (
    <Flex direction="column" gap={14}>
      <Flex align="center" gap={12} wrap="wrap">
        <OptionToggle
          size="2"
          ariaLabel="Range"
          items={agentTrackingRangePresets.map(preset => ({
            id: preset.id,
            label: preset.label
          }))}
          value={range}
          onChange={value => onPatch({ range: value as AgentTrackingRangePreset })}
        />

        <div style={{ width: 230 }}>
          <Select
            size="2"
            label="Sort By"
            hideLabel
            items={definition.sorts.map(sort => ({ id: sort.id, label: `By ${sort.label}` }))}
            value={params.sort}
            onChange={value => onPatch({ sort: value as InsightsSort })}
          />
        </div>

        <OptionToggle
          size="2"
          ariaLabel="Order"
          itemMinWidth={120}
          items={orderItems(params.sort)}
          value={params.order ?? 'desc'}
          onChange={value => onPatch({ order: value as SortOrder })}
        />
      </Flex>

      {has('modelIds') ? (
        <EntityPicker
          instanceId={instanceId}
          field="model"
          range={range}
          value={params.modelIds ?? []}
          latest={() => current().state.params.modelIds ?? []}
          onChange={modelIds => onPatch({ modelIds })}
        />
      ) : null}

      {has('seats') ? (
        <EntityPicker
          instanceId={instanceId}
          field="seat"
          range={range}
          value={params.seats ?? []}
          latest={() => current().state.params.seats ?? []}
          onChange={seats => onPatch({ seats })}
        />
      ) : null}

      <Flex align="end" gap={16} wrap="wrap">
        {thresholds.map(item => (
          <ThresholdInput
            key={item.field}
            label={item.label}
            unit="%"
            max={100}
            value={fractionToPercent(params[item.field] ?? 0)}
            onCommit={percent => onPatch({ [item.field]: percentToFraction(percent) })}
          />
        ))}

        {has('seatUsageMaxMicros') ? (
          <ThresholdInput
            label="Flag Usage Below"
            unit="USD"
            max={maxSeatUsageDollars}
            value={microsToDollars(params.seatUsageMaxMicros ?? 0)}
            onCommit={dollars => onPatch({ seatUsageMaxMicros: dollarsToMicros(dollars) })}
          />
        ) : null}

        {has('includeInactive') || has('flaggedOnly') ? (
          <Flex direction="column" gap={8} style={{ paddingBottom: 4 }}>
            {has('includeInactive') ? (
              <Switch
                label="Include Members Without Usage"
                checked={!!params.includeInactive}
                onCheckedChange={checked => onPatch({ includeInactive: checked })}
              />
            ) : null}

            {has('flaggedOnly') ? (
              <Switch
                label="Flagged Only"
                checked={!!params.flaggedOnly}
                onCheckedChange={checked => onPatch({ flaggedOnly: checked })}
              />
            ) : null}
          </Flex>
        ) : null}
      </Flex>

      {has('includeInactive') && params.includeInactive ? (
        <Text size="1" color="gray600">
          {`Members without usage are those seen in this instance in the last ${memberWindowDays} days, and its consumers.`}
        </Text>
      ) : null}
    </Flex>
  );
};
