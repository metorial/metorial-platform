import { describe, expect, it } from 'vitest';
import { agentTrackingRangeFilter, hiddenIndividualsSpendRangeFilter } from './range';

let optionIds = ({
  filter
}: typeof agentTrackingRangeFilter | typeof hiddenIndividualsSpendRangeFilter) =>
  filter.type == 'select' ? filter.options.map(option => option.id) : [];

describe('agentTrackingRangeFilter', () => {
  it('offers every preset, but no Today while individuals are hidden', () => {
    expect(optionIds(agentTrackingRangeFilter)).toEqual([
      'today',
      'last_7_days',
      'last_30_days',
      'month_to_date',
      'last_month'
    ]);
    expect(optionIds(hiddenIndividualsSpendRangeFilter)).toEqual([
      'last_7_days',
      'last_30_days',
      'month_to_date',
      'last_month'
    ]);
  });
});
