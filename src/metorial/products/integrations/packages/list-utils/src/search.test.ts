import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSearchFilter } from './search';

type Where = Record<string, any>;

describe('buildSearchFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches Voyager hits alongside the exact id', async () => {
    let findIds = vi.fn(async () => ['prov_a', 'prov_b']);

    let filter = await buildSearchFilter<Where>({ search: ' github ', findIds });

    expect(findIds).toHaveBeenCalledWith('github');
    expect(filter).toEqual({
      OR: [{ id: { in: ['prov_a', 'prov_b'] } }, { id: 'github' }]
    });
  });

  it('still matches an exact id that Voyager does not return', async () => {
    let filter = await buildSearchFilter<Where>({
      search: 'dep_123',
      findIds: async () => []
    });

    expect(filter).toEqual({ OR: [{ id: 'dep_123' }] });
  });

  it('uses the custom exact matchers for case-insensitive slugs', async () => {
    let filter = await buildSearchFilter<Where>({
      search: 'My-Agent',
      findIds: async () => ['agt_1'],
      exact: query => [{ id: query }, { slug: { equals: query, mode: 'insensitive' } }]
    });

    expect(filter).toEqual({
      OR: [
        { id: { in: ['agt_1'] } },
        { id: 'My-Agent' },
        { slug: { equals: 'My-Agent', mode: 'insensitive' } }
      ]
    });
  });

  it('maps Voyager hits through matchIds', async () => {
    let filter = await buildSearchFilter<Where>({
      search: 'github',
      findIds: async () => ['lst_1'],
      matchIds: ids => ({ listing: { id: { in: ids } } })
    });

    expect(filter).toEqual({
      OR: [{ listing: { id: { in: ['lst_1'] } } }, { id: 'github' }]
    });
  });

  it('falls back to exact matches when search is disabled', async () => {
    let filter = await buildSearchFilter<Where>({
      search: 'dep_123',
      findIds: async () => null
    });

    expect(filter).toEqual({ OR: [{ id: 'dep_123' }] });
  });

  it('falls back to exact matches when the lookup throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let filter = await buildSearchFilter<Where>({
      search: 'dep_123',
      findIds: async () => {
        throw new Error('voyager unavailable');
      }
    });

    expect(filter).toEqual({ OR: [{ id: 'dep_123' }] });
  });

  it.each([undefined, null, '', '   '])(
    'returns no filter for an empty query (%j)',
    async search => {
      let findIds = vi.fn(async () => ['prov_a']);

      let filter = await buildSearchFilter<Where>({ search, findIds });

      expect(filter).toBeUndefined();
      expect(findIds).not.toHaveBeenCalled();
    }
  );
});
