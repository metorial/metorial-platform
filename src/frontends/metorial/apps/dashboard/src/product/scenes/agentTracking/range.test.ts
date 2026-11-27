import { describe, expect, it } from 'vitest';
import { hiddenIndividualsSpendRangeFilter, spendRangeFilter } from './range';

let optionIds = ({
  filter
}: typeof spendRangeFilter | typeof hiddenIndividualsSpendRangeFilter) =>
  filter.type == 'select' ? filter.options.map(option => option.id) : [];

describe('spendRangeFilter', () => {
  it('offers every preset, but no Today while individuals are hidden', () => {
    expect(optionIds(spendRangeFilter)).toEqual([
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
