import { describe, expect, it } from 'vitest';
import { isQueriedListLoading } from './define';

let list = (isLoading: boolean) => ({ items: [], isLoading });

describe('isQueriedListLoading', () => {
  it('ignores a list asked with no query, which never loads', () => {
    expect(
      isQueriedListLoading([
        [{ limit: 100 }, list(false)],
        [null, list(true)]
      ])
    ).toBe(false);
    expect(isQueriedListLoading([[null, list(true)]])).toBe(false);
  });

  it('loads while a queried list loads', () => {
    expect(
      isQueriedListLoading([
        [{ limit: 100 }, list(true)],
        [null, list(true)]
      ])
    ).toBe(true);
    expect(
      isQueriedListLoading([
        [{ limit: 100 }, list(false)],
        [{ ids: ['abc_123456'] }, list(true)]
      ])
    ).toBe(true);
  });
});
