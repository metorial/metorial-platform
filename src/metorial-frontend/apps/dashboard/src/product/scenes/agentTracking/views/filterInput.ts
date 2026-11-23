import type { TableFilter, TableFilterState } from '@metorial/ui-product';
import { teamViewDefinitions, type TeamViewParams, type TeamViewState } from './definitions';
import { flagRulesOf } from './flagRules';
import { membersWithoutUsageNotice } from './format';

let flaggedOption = 'only';

let includedOption = 'included';

export let flaggedFilter: TableFilter<{ id: string }> = {
  id: 'flagged',
  fields: ['flagged'],
  label: 'Flags',
  description: 'Filter by flags',
  type: 'select',
  options: [{ id: flaggedOption, label: 'Only Flagged' }]
};

export let membersWithoutUsageFilter = (days: number): TableFilter<{ id: string }> => {
  let definition = membersWithoutUsageNotice(days);

  return {
    id: 'inactive',
    fields: ['inactive'],
    label: 'Usage',
    description: `Filter by usage. Members without usage are ${definition[0]!.toLowerCase()}${definition.slice(1)}`,
    type: 'select',
    options: [
      { id: includedOption, label: 'Include Zero Usage', description: definition }
    ]
  };
};

export let showsFlaggedFilter = (view: TeamViewState) => flagRulesOf(view).length > 0;

export let showsInactiveFilter = (view: TeamViewState) =>
  teamViewDefinitions[view.kind].fields.includes('includeInactive');

let selected = (id: string, option: string): TableFilterState => ({
  id,
  fields: [id],
  type: 'select',
  operation: 'eq',
  value: [option]
});

export let toToggleFilterStates = (view: TeamViewState): TableFilterState[] => [
  ...(showsFlaggedFilter(view) && view.params.flaggedOnly
    ? [selected(flaggedFilter.id, flaggedOption)]
    : []),
  ...(showsInactiveFilter(view) && view.params.includeInactive
    ? [selected('inactive', includedOption)]
    : [])
];

export let fromToggleFilterStates = (
  view: TeamViewState,
  states: TableFilterState[]
): TeamViewParams => {
  let isOn = (id: string, option: string) =>
    states.some(
      state => state.id == id && state.type == 'select' && state.value.includes(option)
    );

  return {
    ...(showsFlaggedFilter(view)
      ? { flaggedOnly: isOn(flaggedFilter.id, flaggedOption) }
      : {}),
    ...(showsInactiveFilter(view) ? { includeInactive: isOn('inactive', includedOption) } : {})
  };
};
