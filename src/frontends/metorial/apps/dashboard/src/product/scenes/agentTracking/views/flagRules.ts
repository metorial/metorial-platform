import { formatCurrency, formatPercent } from '@metorial/chart';
import {
  dollarsOf,
  fractionToPercent,
  percentToFraction,
  toDollars,
  toMicros
} from '../costFormat';
import {
  insightFlagDefinitions,
  teamViewDefinitions,
  type TeamViewParams,
  type TeamViewState
} from './definitions';
import { canSaveTeamView, resolveTeamView } from './state';

let microsPerDollar = 1_000_000;

let flagRules = insightFlagDefinitions.map(({ field, label, below, unit }) => ({
  field,
  unit,
  text: `${label} ${below ? '<' : '≥'}`,
  label: `Flag ${label} ${below ? 'Below' : 'at or Above'}`
}));

type FlagRule = (typeof flagRules)[number];

let toCents = (dollars: number) => Math.round(dollars * 100) / 100;

let formatThresholdDollars = (micros: number) =>
  formatCurrency(dollarsOf(micros), { precision: micros % microsPerDollar == 0 ? 0 : 2 });

export let toRuleInput = (rule: FlagRule, value: number | undefined) =>
  rule.unit == 'USD' ? toCents(toDollars(value ?? 0) ?? 0) : fractionToPercent(value ?? 0);

export let fromRuleInput = (rule: FlagRule, value: number) =>
  rule.unit == 'USD' ? toMicros(toCents(value)) : percentToFraction(value);

export let flagRulesOf = (view: TeamViewState) => {
  if (!canSaveTeamView(view)) return [];

  let fields = teamViewDefinitions[view.kind].fields;
  return flagRules.filter(rule => fields.includes(rule.field));
};

export let flagRulesLabel = (view: TeamViewState) => {
  let rules = flagRulesOf(view);
  if (rules.length != 1) return `Flag Rules · ${rules.length}`;

  let rule = rules[0]!;
  let value = resolveTeamView(view.kind, view.params).params[rule.field] ?? 0;
  let threshold =
    rule.unit == 'USD'
      ? formatThresholdDollars(value)
      : formatPercent(value, { precision: 2 });

  return `Flag: ${rule.text} ${threshold}`;
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
