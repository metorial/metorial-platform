// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NetworkFirewallsPage } from './firewalls';

let state = vi.hoisted(() => ({ search: '', query: undefined as any, placeholder: '' }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@metorial/state', () => ({
  useCurrentInstance: () => ({ data: { id: 'instance' } }),
  useCurrentOrganization: () => ({}),
  useCurrentProject: () => ({}),
  useFirewalls: (_instance: any, query: any) => {
    state.query = query;
    return {
      data: {
        items: query.search
          ? [{ id: 'remote', name: 'Remote Firewall', description: 'Private traffic' }]
          : [],
        pagination: {}
      }
    };
  }
}));
vi.mock('@metorial/data-list', () => {
  let createDataList = () => {
    let source: any;
    let builder: any = {
      context: () => builder,
      search: (placeholder: string) => {
        state.placeholder = placeholder;
        return builder;
      },
      paginated: (fn: any) => {
        source = fn;
        return builder;
      },
      columns: () => builder,
      link: () => builder,
      build: () => (props: any) => {
        let result = source({
          props,
          ctx: { instanceId: 'instance' },
          search: state.search || undefined
        });
        return (
          <div>
            {(result.data?.items ?? []).map((item: any) => (
              <span key={item.id}>{item.name}</span>
            ))}
          </div>
        );
      }
    };
    return builder;
  };

  let column = () => ({});
  let col = { name: column, status: column, count: column, updatedAt: column, id: column };

  return { createDataList, col, lifecycleStatus: {} };
});
vi.mock('../../../lib/dataList', () => ({
  useInstanceContext: () => ({ instanceId: 'instance' })
}));
vi.mock('@metorial/data-hooks', () => ({ useForm: vi.fn() }));
vi.mock('@metorial/frontend-config', () => ({ Paths: {} }));
vi.mock('@metorial/ui', () => ({
  Button: () => null,
  Dialog: {},
  Input: () => null,
  Spacer: () => null,
  showModal: vi.fn()
}));
vi.mock('@metorial/ui-product', () => ({}));
vi.mock('react-router-dom', () => ({ useNavigate: vi.fn() }));
vi.mock('../_gate', () => ({ useNetworkManagementAccess: () => ({ canWrite: false }) }));

it('enables table search, forwards the query and clears it', async () => {
  let host = document.createElement('div');
  let root = createRoot(host);

  try {
    state.search = 'Private';
    await act(async () => root.render(<NetworkFirewallsPage />));
    expect(state.placeholder).toBe('Search firewalls…');
    expect(state.query).toEqual({ order: 'desc', search: 'Private' });
    expect(host.textContent).toContain('Remote Firewall');

    state.search = '';
    await act(async () => root.render(<NetworkFirewallsPage />));
    expect(state.query.search).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
  }
});
