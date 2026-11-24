import { Button, OptionToggle, Popover, Text, theme } from '@metorial/ui';
import {
  FilterToolbar,
  getListValue,
  toFilterFieldNames,
  type FilterStateTuple,
  type TableFilterState
} from '@metorial/ui-product';
import React, { useMemo } from 'react';
import { styled } from 'styled-components';
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
  type TeamViewField,
  type TeamViewParams,
  type TeamViewState
} from './definitions';
import {
  flagRulesLabel,
  flagRulesModified,
  flagRulesOf,
  flagRulesResetPatch,
  fromRuleInput,
  toRuleInput
} from './flagRules';
import {
  flaggedFilter,
  fromToggleFilterStates,
  membersWithoutUsageFilter,
  showsFlaggedFilter,
  showsInactiveFilter,
  toToggleFilterStates
} from './filterInput';

let inactiveFilter = membersWithoutUsageFilter(memberWindowDays);

let RangeScroll = styled.div`
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
`;

let RulesGrid = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 10px 14px;
  cursor: default;
`;

let ModifiedDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${theme.colors.blue900};
`;

let has = (view: TeamViewState, field: TeamViewField) =>
  teamViewDefinitions[view.kind].fields.includes(field);

let TeamFilterInput = ({
  instanceId,
  view,
  range,
  current,
  onPatch
}: {
  instanceId: string;
  view: TeamViewState;
  range: AgentTrackingRangePreset;
  current: () => { state: TeamViewState };
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let field: 'model' | 'seat' | null = has(view, 'modelIds')
    ? 'model'
    : has(view, 'seats')
      ? 'seat'
      : null;
  let listKey: 'modelIds' | 'seats' = field == 'model' ? 'modelIds' : 'seats';
  let entity = useMemo(
    () => (field ? agentTrackingFilters[field](instanceId) : null),
    [instanceId, field]
  );

  let filters = [
    ...(entity ? [entity] : []),
    ...(showsFlaggedFilter(view) ? [flaggedFilter] : []),
    ...(showsInactiveFilter(view) ? [inactiveFilter] : [])
  ];

  let toState = (state: TeamViewState): TableFilterState[] => {
    let values = state.params[listKey] ?? [];

    return [
      ...(entity && values.length
        ? [
            {
              id: entity.id,
              fields: toFilterFieldNames(entity.fields),
              type: 'entity' as const,
              operation: 'eq' as const,
              value: values
            }
          ]
        : []),
      ...toToggleFilterStates(state)
    ];
  };

  let setState: FilterStateTuple[1] = action => {
    let latest = current().state;
    let next = typeof action == 'function' ? action(toState(latest)) : action;

    onPatch({
      ...(entity ? { [listKey]: getListValue(next.find(item => item.id == entity.id)) } : {}),
      ...fromToggleFilterStates(latest, next)
    });
  };

  return (
    <AgentTrackingFilterRangeContext.Provider value={range}>
      <FilterToolbar
        filters={filters}
        filterState={[toState(view), setState]}
        panelLayout="full"
        style={{ flex: '1 1 420px', width: 'auto' }}
        placeholder={field == 'model' ? 'Choose models...' : 'Filter...'}
      />
    </AgentTrackingFilterRangeContext.Provider>
  );
};

let FlagRulesButton = ({
  view,
  onPatch
}: {
  view: TeamViewState;
  onPatch: (patch: TeamViewParams) => void;
}) => {
  let label = flagRulesLabel(view);
  let modified = flagRulesModified(view);

  return (
    <Popover
      side="bottom"
      align="start"
      sideOffset={8}
      trigger={
        <Button
          size="2"
          variant="outline"
          aria-label={modified ? `${label}, changed from the defaults` : label}
          iconRight={modified ? <ModifiedDot aria-hidden /> : undefined}
        >
          {label}
        </Button>
      }
    >
      <Popover.Content>
        <RulesGrid>
          {flagRulesOf(view).map(rule => (
            <React.Fragment key={rule.field}>
              <Text as="span" size="2">
                {rule.text}
              </Text>

              <CommitNumberInput
                label={rule.label}
                hideLabel
                unit={rule.unit}
                size="2"
                min={0}
                max={rule.unit == 'USD' ? maxSeatUsageDollars : 100}
                step={1}
                format={{ maximumFractionDigits: 2 }}
                style={{ width: rule.unit == 'USD' ? 140 : 100 }}
                commitOnUnmount
                value={toRuleInput(rule, view.params[rule.field])}
                onCommit={value => onPatch({ [rule.field]: fromRuleInput(rule, value) })}
              />
            </React.Fragment>
          ))}
        </RulesGrid>

        {modified ? (
          <Button
            size="1"
            variant="soft"
            style={{ marginTop: 12 }}
            onClick={() => onPatch(flagRulesResetPatch(view))}
          >
            Reset to Defaults
          </Button>
        ) : null}
      </Popover.Content>
    </Popover>
  );
};

export let TeamViewFilters = ({
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
  let params = view.params;
  let range = params.range ?? defaultAgentTrackingRange;

  return (
    <>
      <RangeScroll>
        <OptionToggle
          size="2"
          ariaLabel="Range"
          itemMinWidth={64}
          items={agentTrackingRangePresets.map(preset => ({
            id: preset.id,
            label: preset.label
          }))}
          value={range}
          onChange={value => onPatch({ range: value as AgentTrackingRangePreset })}
        />
      </RangeScroll>

      <TeamFilterInput
        instanceId={instanceId}
        view={view}
        range={range}
        current={current}
        onPatch={onPatch}
      />

      {flagRulesOf(view).length ? <FlagRulesButton view={view} onPatch={onPatch} /> : null}
    </>
  );
};
