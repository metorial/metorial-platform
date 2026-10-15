import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeToolCategories, resolveToolCategoryKeys } from './toolCategories';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeToolCategories', () => {
  it('returns an empty list for missing categories', () => {
    expect(normalizeToolCategories(undefined)).toEqual([]);
    expect(normalizeToolCategories(null)).toEqual([]);
    expect(normalizeToolCategories([])).toEqual([]);
  });

  it('keeps declared order, dedupes by key and omits empty descriptions', () => {
    expect(
      normalizeToolCategories([
        { key: 'crm', name: 'Zoho CRM', description: 'Customer records' },
        { key: 'books', name: 'Zoho Books', description: null },
        { key: 'crm', name: 'Duplicate CRM' },
        { key: 'desk', name: 'Zoho Desk', description: '' }
      ])
    ).toEqual([
      { key: 'crm', name: 'Zoho CRM', description: 'Customer records' },
      { key: 'books', name: 'Zoho Books' },
      { key: 'desk', name: 'Zoho Desk' }
    ]);
  });

  it('keeps a category image only when one is set', () => {
    expect(
      normalizeToolCategories([
        { key: 'crm', name: 'Zoho CRM', imageUrl: 'https://cdn.test/crm.svg' },
        { key: 'people', name: 'Zoho People', imageUrl: null },
        { key: 'desk', name: 'Zoho Desk', imageUrl: '' }
      ])
    ).toEqual([
      { key: 'crm', name: 'Zoho CRM', imageUrl: 'https://cdn.test/crm.svg' },
      { key: 'people', name: 'Zoho People' },
      { key: 'desk', name: 'Zoho Desk' }
    ]);
  });

  it('never writes undefined values', () => {
    let [category] = normalizeToolCategories([{ key: 'crm', name: 'Zoho CRM' }]);
    expect(Object.keys(category!)).toEqual(['key', 'name']);
  });

  it('drops malformed entries', () => {
    expect(
      normalizeToolCategories([
        { key: '', name: 'Empty' },
        { key: 'crm', name: 1 as any },
        null as any,
        { key: 'books', name: 'Zoho Books' }
      ])
    ).toEqual([{ key: 'books', name: 'Zoho Books' }]);
  });
});

describe('resolveToolCategoryKeys', () => {
  let defined = new Set(['crm', 'books', 'desk']);

  it('returns an empty list for tools without categories', () => {
    expect(resolveToolCategoryKeys(undefined, defined, { toolKey: 'who_am_i' })).toEqual([]);
    expect(resolveToolCategoryKeys(null, defined, { toolKey: 'who_am_i' })).toEqual([]);
  });

  it('keeps the tool order and dedupes keys', () => {
    expect(
      resolveToolCategoryKeys(['desk', 'crm', 'desk'], defined, { toolKey: 'search' })
    ).toEqual(['desk', 'crm']);
  });

  it('drops unknown keys with a warning', () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      resolveToolCategoryKeys(['crm', 'unknown', 'books'], defined, {
        toolKey: 'crm_get_records',
        specId: 'spec_1'
      })
    ).toEqual(['crm', 'books']);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toEqual({
      specId: 'spec_1',
      toolKey: 'crm_get_records',
      unknownKeys: ['unknown']
    });
  });

  it('drops all keys when the specification defines no categories', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      resolveToolCategoryKeys(['crm'], new Set(), { toolKey: 'crm_get_records' })
    ).toEqual([]);
  });

  it('does not warn when every key is known', () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveToolCategoryKeys(['crm'], defined, { toolKey: 'crm_get_records' });

    expect(warn).not.toHaveBeenCalled();
  });
});
