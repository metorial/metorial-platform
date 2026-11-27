import { describe, expect, it } from 'vitest';
import {
  flagRulesLabel,
  flagRulesModified,
  flagRulesOf,
  flagRulesResetPatch,
  fromRuleInput,
  toRuleInput
} from './flagRules';
import { defaultTeamView, resolveTeamView, writeTeamViewSearch } from './state';

let byModel = (params = {}) => resolveTeamView('by_model', { modelIds: ['a/x'], ...params });

describe('flag rules', () => {
  it('applies only where thresholds do', () => {
    expect(flagRulesOf(defaultTeamView('recent'))).toEqual([]);
    expect(flagRulesOf(defaultTeamView('leaderboard'))).toEqual([]);
    expect(flagRulesOf(defaultTeamView('by_model'))).toEqual([]);
    expect(flagRulesOf(byModel()).map(rule => rule.field)).toEqual(['modelShareMin']);
    expect(flagRulesOf(defaultTeamView('practices'))).toHaveLength(4);
  });

  it('shows a single rule in the label', () => {
    expect(flagRulesLabel(byModel())).toBe('Flag: Share ≥ 50%');
    expect(flagRulesLabel(byModel({ modelShareMin: 0.4 }))).toBe('Flag: Share ≥ 40%');
    expect(flagRulesLabel(defaultTeamView('seats'))).toBe('Flag: Usage < $50');
    expect(flagRulesLabel(resolveTeamView('seats', { seatUsageMaxMicros: 20_100_000 }))).toBe(
      'Flag: Usage < $20.10'
    );
    expect(flagRulesLabel(resolveTeamView('seats', { seatUsageMaxMicros: 49_500_000 }))).toBe(
      'Flag: Usage < $49.50'
    );
  });

  it('converts a usage threshold between dollars and micros at cent precision', () => {
    let rule = flagRulesOf(defaultTeamView('seats'))[0]!;

    expect(fromRuleInput(rule, 50)).toBe(50_000_000);
    expect(fromRuleInput(rule, 0.29)).toBe(290_000);
    expect(fromRuleInput(rule, 50.1)).toBe(50_100_000);
    expect(fromRuleInput(rule, 19.999)).toBe(20_000_000);

    expect(toRuleInput(rule, 50_100_000)).toBe(50.1);
    expect(toRuleInput(rule, 290_000)).toBe(0.29);
    expect(toRuleInput(rule, 12_345_678)).toBe(12.35);
  });

  it('counts several rules', () => {
    expect(flagRulesLabel(defaultTeamView('practices'))).toBe('Flag Rules · 4');
  });

  it('sees a threshold that differs from the defaults', () => {
    expect(flagRulesModified(defaultTeamView('practices'))).toBe(false);
    expect(flagRulesModified(resolveTeamView('practices', { fastShareMin: 0.3 }))).toBe(true);
    expect(flagRulesModified(resolveTeamView('practices', { flaggedOnly: true }))).toBe(false);
    expect(flagRulesModified(byModel({ modelShareMin: 0.4 }))).toBe(true);
  });

  it('resets every threshold of the view in one patch, leaving the rest', () => {
    let changed = resolveTeamView('practices', {
      highEffortShareMin: 0.9,
      cacheHitRateMax: 0.2,
      flaggedOnly: true
    });
    let reset = resolveTeamView('practices', {
      ...changed.params,
      ...flagRulesResetPatch(changed)
    });

    expect(flagRulesModified(reset)).toBe(false);
    expect(writeTeamViewSearch(new URLSearchParams(), reset, null).toString()).toBe(
      'view=practices&flagged=1'
    );
  });
});
