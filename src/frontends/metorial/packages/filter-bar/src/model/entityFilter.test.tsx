// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  createEntityFilter,
  sortExactMatchesFirst,
  useEntityFilterLabels
} from './entityFilter';
import {
  deserializeFromQuery,
  getFilterPayload,
  serializeToQuery,
  type TableFilterState
} from './tableFilter';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let render = (element: React.ReactElement) => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  let root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => act(() => root.unmount()) };
};

let providerFilter = (useSearch = vi.fn(() => ({ items: [], isLoading: false }))) =>
  createEntityFilter({
    id: 'providerId',
    label: 'Provider',
    useSearch,
    useByIds: ids => ids.map(id => ({ id, label: `Name of ${id}` }))
  });

describe('entity filters', () => {
  it('round-trips multiple values through the URL', () => {
    let filter = providerFilter();
    let state: TableFilterState[] = [
      {
        id: 'providerId',
        fields: ['providerId'],
        type: 'entity',
        operation: 'eq',
        value: ['pro_a', 'pro_b']
      }
    ];

    let query = new URLSearchParams(serializeToQuery(state));
    let restored = deserializeFromQuery(query, [filter]);

    expect(restored).toEqual(state);
    expect(getFilterPayload(restored)).toEqual({ providerId: { in: ['pro_a', 'pro_b'] } });
  });

  it('resolves chip labels when nothing is cached', () => {
    let filter = providerFilter();
    let labels: string[] = [];

    let Probe = () => {
      labels = useEntityFilterLabels(filter, ['pro_uncached']);
      return null;
    };

    let view = render(<Probe />);
    expect(labels).toEqual(['Name of pro_uncached']);
    view.unmount();
  });

  it('puts exact id and slug matches first', () => {
    let items = [
      { id: 'pro_1', label: 'GitHub Enterprise' },
      { id: 'pro_2', label: 'GitHub', slug: 'github' },
      { id: 'pro_3', label: 'Gitea' }
    ];

    expect(sortExactMatchesFirst(items, 'GITHUB').map(item => item.id)).toEqual([
      'pro_2',
      'pro_1',
      'pro_3'
    ]);
    expect(sortExactMatchesFirst(items, 'pro_3')[0]!.id).toBe('pro_3');
  });
});
