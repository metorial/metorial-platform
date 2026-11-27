import { describe, expect, it } from 'vitest';
import {
  fromToggleFilterStates,
  membersWithoutUsageFilter,
  showsFlaggedFilter,
  showsInactiveFilter,
  toToggleFilterStates
} from './filterInput';
import { defaultTeamView, resolveTeamView, writeTeamViewSearch } from './state';

describe('team filter input toggles', () => {
  it('offers each toggle only where the view has it', () => {
    expect(showsFlaggedFilter(defaultTeamView('leaderboard'))).toBe(false);
    expect(showsInactiveFilter(defaultTeamView('leaderboard'))).toBe(true);
    expect(showsFlaggedFilter(defaultTeamView('by_model'))).toBe(false);
    expect(showsFlaggedFilter(resolveTeamView('by_model', { modelIds: ['a/x'] }))).toBe(true);
    expect(showsInactiveFilter(defaultTeamView('practices'))).toBe(false);
    expect(showsFlaggedFilter(defaultTeamView('seats'))).toBe(true);
    expect(showsInactiveFilter(defaultTeamView('seats'))).toBe(true);
  });

  it('shows a chip for each toggle that is on', () => {
    expect(toToggleFilterStates(defaultTeamView('practices'))).toEqual([]);
    expect(
      toToggleFilterStates(defaultTeamView('seats')).map(state => [state.id, state.value])
    ).toEqual([['inactive', ['included']]]);
    expect(
      toToggleFilterStates(resolveTeamView('seats', { flaggedOnly: true })).map(
        state => state.id
      )
    ).toEqual(['flagged', 'inactive']);
  });

  it('writes the same flagged and inactive parameters as the switches did', () => {
    let seats = defaultTeamView('seats');
    let on = resolveTeamView('seats', {
      ...seats.params,
      ...fromToggleFilterStates(seats, [
        {
          id: 'flagged',
          fields: ['flagged'],
          type: 'select',
          operation: 'eq',
          value: ['only']
        }
      ])
    });

    expect(writeTeamViewSearch(new URLSearchParams(), on, null).toString()).toBe(
      'view=seats&inactive=0&flagged=1'
    );
    expect(fromToggleFilterStates(seats, toToggleFilterStates(seats))).toEqual({
      flaggedOnly: false,
      includeInactive: true
    });
  });

  it('touches only the toggles of the view when all filters are cleared', () => {
    expect(fromToggleFilterStates(defaultTeamView('practices'), [])).toEqual({
      flaggedOnly: false
    });
    expect(fromToggleFilterStates(defaultTeamView('leaderboard'), [])).toEqual({
      includeInactive: false
    });
  });

  it('carries the definition of members without usage', () => {
    let filter = membersWithoutUsageFilter(400);

    expect(filter.description).toBe(
      "Filter by usage. Members without usage are the instance's consumers and the people seen in it in the last 400 days who have no usage in this range."
    );
  });
});
