// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createEntityFilter } from '../model/entityFilter';
import { getFilterText, summarizeLabels, type ListFilter } from '../model/state';
import type { TableFilter, TableFilterState } from '../model/tableFilter';
import { FilterHighlightRow } from './highlightRow';
import { OptionList } from './optionList';
import { FilterSearchBar } from './searchBar';
import { FilterToolbar } from './toolbar';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1000
  });
});

let cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach(fn => fn());
});

let render = (element: React.ReactElement) => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  let root = createRoot(container);
  act(() => root.render(element));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
};

let statusFilter: TableFilter<any> = {
  id: 'status',
  fields: ['status'],
  label: 'Status',
  description: 'Filter by status',
  type: 'select',
  highlight: true,
  options: [
    { id: 'active', label: 'Active', count: 12 },
    { id: 'archived', label: 'Archived', count: 3 }
  ]
};

let plainStatusFilter: TableFilter<any> = { ...statusFilter, highlight: undefined };

let statusState: TableFilterState = {
  id: 'status',
  fields: ['status'],
  type: 'select',
  operation: 'eq',
  value: ['active']
};

let useStateProbe = (initial: TableFilterState[]) => {
  let probe = { current: initial };
  let Harness = ({ children }: { children: (s: any) => React.ReactNode }) => {
    let tuple = useState(initial);
    probe.current = tuple[0];
    return <>{children(tuple)}</>;
  };
  return { probe, Harness };
};

describe('filter state helpers', () => {
  it('summarizes long label lists', () => {
    expect(summarizeLabels(['A'])).toBe('A');
    expect(summarizeLabels(['A', 'B', 'C', 'D'])).toBe('A, B +2');
  });

  it('describes number filters with their operation', () => {
    let filter: TableFilter<any> = {
      id: 'count',
      fields: ['count'],
      label: 'Count',
      description: 'Filter by count',
      type: 'number'
    };

    expect(
      getFilterText(filter, {
        id: 'count',
        fields: ['count'],
        type: 'number',
        operation: 'gt',
        value: 5
      })
    ).toBe('> 5');
  });
});

describe('FilterHighlightRow', () => {
  it('toggles a value when its pill is clicked', () => {
    let { probe, Harness } = useStateProbe([]);
    let container = render(
      <Harness>
        {tuple => (
          <FilterHighlightRow filter={statusFilter as ListFilter} filterState={tuple} />
        )}
      </Harness>
    );

    let pill = Array.from(container.querySelectorAll('button[aria-pressed]')).find(
      b => !b.closest('[aria-hidden]') && b.textContent?.startsWith('Archived')
    );
    act(() => (pill as HTMLButtonElement).click());

    expect(probe.current).toEqual([
      expect.objectContaining({ id: 'status', type: 'select', value: ['archived'] })
    ]);
  });

  it('passes the other filter values to entity useOptions', () => {
    let useSearch = vi.fn(() => ({ items: [], isLoading: false }));
    let toolFilter = createEntityFilter({
      id: 'toolId',
      label: 'Tool',
      highlight: true,
      useSearch,
      useByIds: ids => ids.map(id => ({ id, label: id }))
    });
    let state: TableFilterState[] = [
      {
        id: 'providerId',
        fields: ['providerId'],
        type: 'entity',
        operation: 'eq',
        value: ['pro_a']
      }
    ];

    let { Harness } = useStateProbe(state);
    render(
      <Harness>
        {tuple => <FilterHighlightRow filter={toolFilter as ListFilter} filterState={tuple} />}
      </Harness>
    );

    expect(useSearch).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { providerId: { in: ['pro_a'] } } })
    );
  });
});

describe('FilterSearchBar', () => {
  it('shows applied filters as tokens and removes the last one with backspace', () => {
    let { probe, Harness } = useStateProbe([statusState]);
    let container = render(
      <Harness>
        {tuple => (
          <FilterSearchBar
            filters={[plainStatusFilter]}
            filterState={tuple}
            searchState={['', () => {}]}
            shortcut={false}
          />
        )}
      </Harness>
    );

    expect(
      container.querySelector('[aria-label="Status: Active. Edit filter"]')
    ).not.toBeNull();

    let input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    act(() => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(probe.current).toEqual([]);
  });

  it('shows highlighted filter values chosen outside the pills as a token', () => {
    let { Harness } = useStateProbe([statusState]);
    let container = render(
      <Harness>
        {tuple => (
          <FilterSearchBar filters={[statusFilter]} filterState={tuple} shortcut={false} />
        )}
      </Harness>
    );

    expect(
      container.querySelector('[aria-label="Status: Active. Edit filter"]')
    ).not.toBeNull();
  });

  it('keeps values chosen through the pills out of the bar, but still in the panel badge', () => {
    let { probe, Harness } = useStateProbe([]);
    let container = render(
      <Harness>
        {tuple => (
          <FilterToolbar
            filters={[statusFilter]}
            filterState={tuple}
            searchState={['', () => {}]}
            shortcut={false}
          />
        )}
      </Harness>
    );

    let pill = Array.from(container.querySelectorAll('button[aria-pressed]')).find(
      b => !b.closest('[aria-hidden]') && b.textContent?.startsWith('Active')
    );
    act(() => (pill as HTMLButtonElement).click());

    expect(probe.current).toEqual([
      expect.objectContaining({ id: 'status', value: ['active'] })
    ]);
    expect(container.querySelector('[aria-label="Status: Active. Edit filter"]')).toBeNull();
    expect(container.querySelector('[aria-label="Filters (1 applied)"]')).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll('button[aria-pressed="true"]')).length
    ).toBeGreaterThan(0);
  });

  it('removes a token through its remove button', () => {
    let { probe, Harness } = useStateProbe([statusState]);
    let container = render(
      <Harness>
        {tuple => (
          <FilterSearchBar
            filters={[plainStatusFilter]}
            filterState={tuple}
            shortcut={false}
          />
        )}
      </Harness>
    );

    act(() =>
      (
        container.querySelector('[aria-label="Remove Status filter"]') as HTMLButtonElement
      ).click()
    );

    expect(probe.current).toEqual([]);
  });
});

describe('OptionList', () => {
  it('toggles once when the row edge or the label is clicked', () => {
    let onToggle = vi.fn();
    let container = render(
      <OptionList
        items={[{ id: 'crm', label: 'CRM' }]}
        selected={[]}
        onToggle={onToggle}
        search=""
        onSearch={() => {}}
        showSearch={false}
      />
    );

    let label = Array.from(container.querySelectorAll('label')).find(
      l => l.textContent == 'CRM' && !l.closest('[style*="clip"]')
    )!;
    let row = label.closest('[style*="top"]') as HTMLElement;

    act(() => row.click());
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenLastCalledWith('crm', true);

    act(() => label.click());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
