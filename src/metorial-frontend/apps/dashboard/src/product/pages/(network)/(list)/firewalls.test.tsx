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
vi.mock('@metorial/table', () => ({
  Table: class {
    provider: any;
    state(provider: any) {
      this.provider = provider;
      return this;
    }
    search(placeholder: string) {
      state.placeholder = placeholder;
      return this;
    }
    columns() {
      return this;
    }
    link() {
      return this;
    }
    build() {
      return (props: any) => (
        <div>
          {this.provider(props, { search: state.search }).items.map((item: any) => (
            <span key={item.id}>{item.name}</span>
          ))}
        </div>
      );
    }
  }
}));
vi.mock('@metorial/data-hooks', () => ({ useForm: vi.fn() }));
vi.mock('@metorial/frontend-config', () => ({ Paths: {} }));
vi.mock('@metorial/ui', () => ({}));
vi.mock('@metorial/ui-product', () => ({}));
vi.mock('react-router-dom', () => ({ useNavigate: vi.fn() }));
vi.mock('../_common', () => ({ statusBadge: vi.fn() }));
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
