import { describe, expect, it } from 'vitest';
import { fractionToPercent, percentToFraction } from '../costFormat';
import { teamViewDefinitions, teamViewKinds, type TeamViewState } from './definitions';
import {
  activeTeamViewKind,
  canSaveTeamView,
  defaultTeamView,
  fromSavedView,
  isSameTeamView,
  parseTeamViewSearch,
  patchTeamViewSearch,
  resolveTeamView,
  sortPatch,
  teamViewHref,
  toInsightsQuery,
  toSavedViewParams,
  writeTeamViewSearch
} from './state';

let customized: Record<(typeof teamViewKinds)[number], TeamViewState> = {
  recent: { kind: 'recent', params: { range: 'today' } },
  leaderboard: {
    kind: 'leaderboard',
    params: { range: 'last_7_days', sort: 'requests', order: 'asc', includeInactive: true }
  },
  by_model: {
    kind: 'by_model',
    params: {
      range: 'month_to_date',
      sort: 'model_share',
      order: 'asc',
      modelIds: ['anthropic/claude-opus-4-1', 'unknown'],
      modelShareMin: 0.35
    }
  },
  practices: {
    kind: 'practices',
    params: {
      range: 'last_month',
      sort: 'cache_hit_rate',
      order: 'asc',
      highEffortShareMin: 0.9,
      fastShareMin: 0.1,
      outdatedShareMin: 0.29,
      cacheHitRateMax: 0.07,
      flaggedOnly: true
    }
  },
  seats: {
    kind: 'seats',
    params: {
      range: 'today',
      sort: 'last_activity',
      order: 'desc',
      includeInactive: false,
      seats: ['premium', 'standard'],
      seatUsageMaxMicros: 20_100_000,
      flaggedOnly: true
    }
  }
};

let parse = (search: string) => parseTeamViewSearch(new URLSearchParams(search));

describe('team view URL state', () => {
  it('defaults to the recent view with no parameters', () => {
    let { state, savedId } = parse('');

    expect(state).toEqual({ kind: 'recent', params: {} });
    expect(savedId).toBeNull();
  });

  it.each(teamViewKinds)('round trips the defaults of %s', kind => {
    let search = writeTeamViewSearch(new URLSearchParams(), defaultTeamView(kind), null);

    expect(parse(search.toString()).state).toEqual(defaultTeamView(kind));
    expect([...search.keys()]).toEqual(kind == 'recent' ? [] : ['view']);
  });

  it.each(teamViewKinds)('round trips a customized %s view', kind => {
    let search = writeTeamViewSearch(new URLSearchParams(), customized[kind], 'atvw_abc123');
    let parsed = parse(search.toString());

    expect(parsed.savedId).toBe('atvw_abc123');
    expect(isSameTeamView(parsed.state, customized[kind])).toBe(true);
    expect(parsed.state).toEqual(resolveTeamView(kind, customized[kind].params));
  });

  it('keeps unrelated parameters and drops pagination', () => {
    let search = writeTeamViewSearch(
      new URLSearchParams('group=model&after=aten_1&sort=cost&highEffort=10'),
      defaultTeamView('leaderboard'),
      null
    );

    expect(search.toString()).toBe('group=model&view=leaderboard');
  });

  it('falls back to defaults for garbage', () => {
    let { state, savedId } = parse(
      'view=practices&range=forever&sort=seat_usage&order=up&highEffort=abc&fastMode=&flagged=maybe&saved=../../x'
    );

    expect(state).toEqual(defaultTeamView('practices'));
    expect(savedId).toBeNull();
  });

  it('accepts only the sorts of the kind', () => {
    expect(parse('view=leaderboard&sort=requests').state.params.sort).toBe('requests');
    expect(parse('view=leaderboard&sort=high_effort_share').state.params.sort).toBe('cost');
  });

  it('falls back to the recent view for an unknown kind', () => {
    expect(parse('view=everything&sort=cost').state).toEqual(defaultTeamView('recent'));
  });

  it('ignores parameters the kind does not use', () => {
    let { state } = parse('view=leaderboard&modelId=anthropic/claude&highEffort=10&flagged=1');

    expect(state).toEqual(defaultTeamView('leaderboard'));
  });

  it('cleans model and seat lists', () => {
    let seats = parse('view=seats&seat=premium, premium,,standard').state;

    expect(seats.params.seats).toEqual(['premium', 'standard']);
  });

  it('writes thresholds as percent and dollars', () => {
    let search = writeTeamViewSearch(new URLSearchParams(), customized.practices, null);
    let seats = writeTeamViewSearch(new URLSearchParams(), customized.seats, null);

    expect(search.get('outdated')).toBe('29');
    expect(search.get('cacheHit')).toBe('7');
    expect(seats.get('usageBelow')).toBe('20.1');
    expect(seats.get('inactive')).toBe('0');
  });
});

describe('threshold conversions', () => {
  it('converts percent to fractions without float drift', () => {
    expect(percentToFraction(29)).toBe(0.29);
    expect(percentToFraction(7)).toBe(0.07);
    expect(percentToFraction(12.34)).toBe(0.1234);
    expect(percentToFraction(57)).toBe(0.57);
  });

  it('converts fractions to percent without float drift', () => {
    expect(fractionToPercent(0.29)).toBe(29);
    expect(fractionToPercent(0.07)).toBe(7);
    expect(fractionToPercent(0.1234)).toBe(12.34);
    expect(fractionToPercent(0.57)).toBe(57);
  });

  it('round trips every whole percent', () => {
    for (let percent = 0; percent <= 100; percent++) {
      expect(fractionToPercent(percentToFraction(percent))).toBe(percent);
    }
  });
});

describe('insights query', () => {
  it('has no query for the recent view', () => {
    expect(toInsightsQuery(defaultTeamView('recent'), 'UTC')).toBeNull();
  });

  it('waits for a model before querying by model', () => {
    expect(toInsightsQuery(defaultTeamView('by_model'), 'UTC')).toBeNull();
  });

  it('maps a by model view', () => {
    expect(toInsightsQuery(customized.by_model, 'Europe/Berlin')).toEqual({
      limit: 50,
      range: 'month_to_date',
      timeZone: 'Europe/Berlin',
      include: ['models'],
      sort: 'model_share',
      order: 'asc',
      modelId: ['anthropic/claude-opus-4-1', 'unknown'],
      modelShareMin: 0.35
    });
  });

  it('maps a seats view', () => {
    expect(toInsightsQuery(defaultTeamView('seats'), 'UTC')).toEqual({
      limit: 50,
      range: 'last_30_days',
      timeZone: 'UTC',
      include: ['seat'],
      sort: 'seat_usage',
      order: 'asc',
      includeInactive: true,
      seatUsageMaxMicros: 50_000_000
    });
    expect(toInsightsQuery(customized.seats, 'UTC')).toMatchObject({
      seat: ['premium', 'standard'],
      flaggedOnly: true
    });
    expect(toInsightsQuery(customized.seats, 'UTC')).not.toHaveProperty('includeInactive');
  });
});

describe('saved view params', () => {
  it.each(teamViewKinds)('round trips %s', kind => {
    let params = toSavedViewParams(customized[kind]);
    let opened = fromSavedView({ kind, params: JSON.parse(JSON.stringify(params)) });

    expect(params.version as unknown).toBe(1);
    expect(isSameTeamView(opened!, customized[kind])).toBe(true);
  });

  it('needs a model before a by model view can be saved', () => {
    expect(canSaveTeamView(defaultTeamView('by_model'))).toBe(false);
    expect(canSaveTeamView(customized.by_model)).toBe(true);
    expect(canSaveTeamView(defaultTeamView('practices'))).toBe(true);
  });

  it('never saves member ids or empty lists', () => {
    let params = toSavedViewParams(defaultTeamView('by_model'));

    expect(params).not.toHaveProperty('modelIds');
    expect(Object.keys(params).some(key => key.startsWith('member'))).toBe(false);
  });

  it('saves only the fields of the kind', () => {
    expect(toSavedViewParams(defaultTeamView('leaderboard'))).toEqual({
      version: 1,
      range: 'last_30_days',
      sort: 'cost',
      order: 'desc',
      includeInactive: false
    });
  });

  it('cannot open an unknown kind, format version or params shape', () => {
    expect(fromSavedView({ kind: 'leaderboard', params: { version: 2 } })).toBeNull();
    expect(fromSavedView({ kind: 'leaderboard', params: { version: true } })).toBeNull();
    expect(fromSavedView({ kind: 'leaderboard', params: { version: '01' } })).toBeNull();
    expect(fromSavedView({ kind: 'leaderboard', params: {} })).toBeNull();
    expect(fromSavedView({ kind: 'everything', params: { version: 1 } })).toBeNull();
    expect(fromSavedView({ kind: 'leaderboard', params: null })).toBeNull();
    expect(fromSavedView({ kind: 'leaderboard', params: [1] })).toBeNull();
  });

  it('falls back to defaults for unreadable fields one by one', () => {
    let open = (kind: string, params: Record<string, unknown>) =>
      fromSavedView({ kind, params: { version: 1, ...params } });

    expect(
      open('leaderboard', {
        sort: 'seat_usage',
        range: 'forever',
        order: 'desc',
        includeInactive: true
      })
    ).toEqual(resolveTeamView('leaderboard', { order: 'desc', includeInactive: true }));

    let practices = open('practices', { highEffortShareMin: 'high', fastShareMin: 0.3 });
    expect(practices?.params.highEffortShareMin).toBe(0.8);
    expect(practices?.params.fastShareMin).toBe(0.3);

    let seats = open('seats', { seatUsageMaxMicros: '1', seats: [1, 'premium'] });
    expect(seats?.params.seatUsageMaxMicros).toBe(50_000_000);
    expect(seats?.params.seats).toEqual([]);
  });

  it('round trips an exact seat threshold through the URL', () => {
    let view = resolveTeamView('seats', { seatUsageMaxMicros: 5_000_012_345_678 });
    let search = writeTeamViewSearch(new URLSearchParams(), view, null);

    expect(search.get('usageBelow')).toBe('5000012.345678');
    expect(parseTeamViewSearch(search).state.params.seatUsageMaxMicros).toBe(
      5_000_012_345_678
    );
  });

  it('ignores keys the kind does not use', () => {
    let practices = fromSavedView({
      kind: 'practices',
      params: { version: 1, includeInactive: true, memberId: 'aten_1' }
    });

    expect(practices).toEqual(defaultTeamView('practices'));
  });

  it('accepts the version as the generated SDK types it', () => {
    expect(fromSavedView({ kind: 'recent', params: { version: '1' } })).toEqual(
      defaultTeamView('recent')
    );
  });

  it('fills fields the saved view leaves out with defaults', () => {
    expect(
      fromSavedView({ kind: 'practices', params: { version: 1, sort: 'fast_share' } })
    ).toEqual(resolveTeamView('practices', { sort: 'fast_share' }));
  });
});

describe('patches', () => {
  let search = (value: string) => new URLSearchParams(value);

  it('keeps a switch flipped before a threshold was committed', () => {
    let flipped = patchTeamViewSearch(search('view=practices'), { flaggedOnly: true });
    let committed = patchTeamViewSearch(flipped, { highEffortShareMin: 0.3 });
    let state = parseTeamViewSearch(committed).state;

    expect(state.params.flaggedOnly).toBe(true);
    expect(state.params.highEffortShareMin).toBe(0.3);
  });

  it('keeps both of two thresholds committed one after the other', () => {
    let first = patchTeamViewSearch(search('view=practices'), { highEffortShareMin: 0.3 });
    let second = patchTeamViewSearch(first, { cacheHitRateMax: 0.2 });
    let state = parseTeamViewSearch(second).state;

    expect(state.params.highEffortShareMin).toBe(0.3);
    expect(state.params.cacheHitRateMax).toBe(0.2);
  });

  it('keeps the saved view and other parameters', () => {
    let next = patchTeamViewSearch(
      search('group=model&view=practices&saved=atvw_1&flagged=1'),
      { outdatedShareMin: 0.5 }
    );

    expect(next.get('saved')).toBe('atvw_1');
    expect(next.get('group')).toBe('model');
    expect(next.get('flagged')).toBe('1');
    expect(next.get('outdated')).toBe('50');
  });
});

describe('same view', () => {
  it('is the same at the defaults', () => {
    for (let kind of teamViewKinds) {
      expect(isSameTeamView(defaultTeamView(kind), defaultTeamView(kind))).toBe(true);
    }
  });

  it('compares lists as sets', () => {
    let a = resolveTeamView('by_model', { modelIds: ['a/x', 'a/y'] });
    let b = resolveTeamView('by_model', { modelIds: ['a/y', 'a/x'] });

    expect(isSameTeamView(a, b)).toBe(true);
  });

  it('sees a changed parameter or kind', () => {
    let base = defaultTeamView('practices');

    expect(isSameTeamView(resolveTeamView('practices', { flaggedOnly: true }), base)).toBe(
      false
    );
    expect(isSameTeamView(defaultTeamView('leaderboard'), base)).toBe(false);
  });

  it('treats explicit defaults as the same', () => {
    let explicit = resolveTeamView('leaderboard', { sort: 'cost', order: 'desc' });

    expect(isSameTeamView(explicit, defaultTeamView('leaderboard'))).toBe(true);
  });
});

describe('header sorting', () => {
  it('flips the order when the active column is clicked again', () => {
    expect(sortPatch(defaultTeamView('leaderboard'), 'cost')).toEqual({ order: 'asc' });
    expect(sortPatch(resolveTeamView('leaderboard', { order: 'asc' }), 'cost')).toEqual({
      order: 'desc'
    });
  });

  it('starts another column at highest first unless its definition says otherwise', () => {
    expect(sortPatch(defaultTeamView('leaderboard'), 'requests')).toEqual({
      sort: 'requests',
      order: 'desc'
    });
    expect(sortPatch(defaultTeamView('practices'), 'high_effort_share')).toEqual({
      sort: 'high_effort_share',
      order: 'desc'
    });
  });

  it('starts low cache hit rates and the stalest members first', () => {
    expect(sortPatch(defaultTeamView('practices'), 'cache_hit_rate')).toEqual({
      sort: 'cache_hit_rate',
      order: 'asc'
    });
    expect(sortPatch(defaultTeamView('seats'), 'last_activity')).toEqual({
      sort: 'last_activity',
      order: 'asc'
    });
  });

  it("returns to a view's default sort in its default order", () => {
    let byCost = resolveTeamView('seats', { sort: 'cost', order: 'desc' });

    expect(sortPatch(byCost, 'seat_usage')).toEqual({ sort: 'seat_usage', order: 'asc' });
  });

  it('keeps defaults out of the URL after a round of clicks', () => {
    let view = defaultTeamView('practices');
    let clicked = resolveTeamView('practices', {
      ...view.params,
      ...sortPatch(view, 'fast_share')
    });
    let back = resolveTeamView('practices', {
      ...clicked.params,
      ...sortPatch(clicked, 'cost')
    });

    expect(writeTeamViewSearch(new URLSearchParams(), clicked, null).get('sort')).toBe(
      'fast_share'
    );
    expect(writeTeamViewSearch(new URLSearchParams(), back, null).toString()).toBe(
      'view=practices'
    );
  });
});

describe('sidebar links', () => {
  let teamPath = '/org/project/instance/agent-usage/team';

  it('links built-in views with only the kind and saved views with their settings', () => {
    expect(teamViewHref(teamPath, defaultTeamView('recent'), null)).toBe(teamPath);
    expect(teamViewHref(teamPath, defaultTeamView('practices'), null)).toBe(
      `${teamPath}?view=practices`
    );
    expect(teamViewHref(teamPath, customized.practices, 'atvw_1')).toBe(
      `${teamPath}?${writeTeamViewSearch(new URLSearchParams(), customized.practices, 'atvw_1')}`
    );
  });

  it('marks the built-in view of the location active', () => {
    let at = (pathname: string, search = '') =>
      activeTeamViewKind({ pathname, search }, teamPath);

    expect(at(teamPath)).toBe('recent');
    expect(at(`${teamPath}/`)).toBe('recent');
    expect(at(teamPath, '?view=by_model&modelId=a')).toBe('by_model');
    expect(at(teamPath, '?view=everything')).toBe('recent');
    expect(at(teamPath, '?view=practices&saved=atvw_1')).toBeNull();
    expect(at(`${teamPath}/aten_1`)).toBeNull();
    expect(at('/org/project/instance/agent-usage/spend', '?view=practices')).toBeNull();
  });
});

describe('flagged cells', () => {
  let flagsOf = (kind: (typeof teamViewKinds)[number]) =>
    teamViewDefinitions[kind].columns.flatMap(column =>
      column.flag ? [[column.flag, column.id]] : []
    );

  it.each([
    ['recent', []],
    ['leaderboard', []],
    ['by_model', [['model_share', 'modelShare']]],
    [
      'practices',
      [
        ['high_effort', 'highEffort'],
        ['fast_mode', 'fastMode'],
        ['outdated_models', 'outdated'],
        ['low_cache_hit_rate', 'cacheHitRate']
      ]
    ],
    ['seats', [['low_usage_seat', 'seatUsage']]]
  ] as const)('highlights the column of each flag in %s', (kind, expected) => {
    expect(flagsOf(kind)).toEqual(expected);
  });
});
