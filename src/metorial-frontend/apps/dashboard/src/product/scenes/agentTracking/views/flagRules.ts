import { teamViewDefinitions, type TeamViewParams, type TeamViewState } from './definitions';
import {
  dollarsToMicros,
  fractionToPercent,
  microsToDollars,
  percentToFraction,
  resolveTeamView
} from './state';

export let flagRules = [
  {
    field: 'highEffortShareMin',
    text: 'High Effort ≥',
    label: 'Flag High Effort at or Above',
    unit: '%'
  },
  {
    field: 'fastShareMin',
    text: 'Fast Mode ≥',
    label: 'Flag Fast Mode at or Above',
    unit: '%'
  },
  {
    field: 'outdatedShareMin',
    text: 'Outdated Models ≥',
    label: 'Flag Outdated Models at or Above',
    unit: '%'
  },
  {
    field: 'cacheHitRateMax',
    text: 'Cache Hit Rate <',
    label: 'Flag Cache Hit Rate Below',
    unit: '%'
  },
  { field: 'modelShareMin', text: 'Share ≥', label: 'Flag Share at or Above', unit: '%' },
  { field: 'seatUsageMaxMicros', text: 'Usage <', label: 'Flag Usage Below', unit: 'USD' }
] as const;

export type FlagRule = (typeof flagRules)[number];

let amount = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

export let toRuleInput = (rule: FlagRule, value: number | undefined) =>
  rule.unit == 'USD' ? microsToDollars(value ?? 0) : fractionToPercent(value ?? 0);

export let fromRuleInput = (rule: FlagRule, value: number) =>
  rule.unit == 'USD' ? dollarsToMicros(value) : percentToFraction(value);

export let flagRulesOf = (view: TeamViewState) => {
  if (view.kind == 'by_model' && !view.params.modelIds?.length) return [];

  let fields = teamViewDefinitions[view.kind].fields;
  return flagRules.filter(rule => fields.includes(rule.field));
};

export let flagRulesLabel = (view: TeamViewState) => {
  let rules = flagRulesOf(view);
  if (rules.length != 1) return `Flag Rules · ${rules.length}`;

  let rule = rules[0]!;
  let value = amount.format(
    toRuleInput(rule, resolveTeamView(view.kind, view.params).params[rule.field])
  );

  return `Flag: ${rule.text} ${rule.unit == 'USD' ? `$${value}` : `${value}%`}`;
};

export let flagRulesResetPatch = (view: TeamViewState): TeamViewParams => {
  let defaults = teamViewDefinitions[view.kind].defaults;
  return Object.fromEntries(flagRulesOf(view).map(rule => [rule.field, defaults[rule.field]]));
};

export let flagRulesModified = (view: TeamViewState) => {
  let { params } = resolveTeamView(view.kind, view.params);
  let reset = flagRulesResetPatch(view);

  return flagRulesOf(view).some(rule => params[rule.field] !== reset[rule.field]);
};
