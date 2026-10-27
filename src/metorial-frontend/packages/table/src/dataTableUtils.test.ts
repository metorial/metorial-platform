import { describe, expect, it } from 'vitest';
import { getDateRangeFilterValue } from './dataTableUtils';

describe('getDateRangeFilterValue', () => {
  it('keeps a midnight inclusive lower bound one millisecond before midnight', () => {
    let midnight = new Date(2026, 9, 22);
    let end = new Date(2026, 9, 22, 6);

    let range = getDateRangeFilterValue({ gte: midnight, lte: new Date(end.getTime() - 1) });

    expect(range?.gt?.getTime()).toBe(midnight.getTime() - 1);
    expect(range?.lt?.getTime()).toBe(end.getTime());
  });

  it('treats a midnight exclusive lower bound as after that whole day', () => {
    let range = getDateRangeFilterValue({ gt: new Date(2026, 9, 22) });

    expect(range?.gt?.getTime()).toBe(new Date(2026, 9, 23).getTime() - 1);
  });

  it('keeps a midnight inclusive upper bound as the whole day', () => {
    let range = getDateRangeFilterValue({ lte: new Date(2026, 9, 22) });

    expect(range?.lt?.getTime()).toBe(new Date(2026, 9, 23).getTime() - 1);
  });
});
