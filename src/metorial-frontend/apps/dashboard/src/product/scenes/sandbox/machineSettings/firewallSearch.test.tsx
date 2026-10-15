// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SandboxNetworkField } from './fields';

let state = vi.hoisted(() => ({
  query: undefined as any,
  search: undefined as string | undefined,
  add: vi.fn(),
  items: [] as any[]
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@metorial/state', () => ({
  useFirewalls: (_instance: any, query: any) => {
    state.query = query;
    return { data: { items: state.items }, isLoading: false };
  },
  useFirewall: (_instance: any, id: string) => ({ data: { name: `Selected ${id}` } })
}));
vi.mock('@metorial/data-hooks', () => ({
  renderWithLoader: (loaders: any) => (render: any) => render(loaders)
}));
vi.mock('@metorial/ui', () => ({
  Flex: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Combobox: ({ provider, onChange }: any) => {
    let result = provider({ searchQuery: state.search });
    return (
      <div>
        {result.items.map((item: any) => (
          <button key={item.id} onClick={() => onChange(item.id)}>
            {item.label}
          </button>
        ))}
        {!result.items.length && result.empty}
      </div>
    );
  }
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  state.search = undefined;
  state.items = [
    { id: 'selected', name: 'Already selected' },
    { id: 'remote', name: 'Remote Firewall', description: 'Private traffic' }
  ];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

let render = () =>
  act(async () =>
    root.render(
      <SandboxNetworkField
        instanceId="instance"
        firewallIds={['selected']}
        publicPorts={[]}
        hideAddPortButton
        onFirewallsChange={state.add}
        onPortsChange={() => {}}
      />
    )
  );

describe('shared machine firewall search', () => {
  it('forwards description searches to the active firewall endpoint and excludes selected IDs', async () => {
    state.search = 'Private';
    await render();
    expect(state.query).toEqual({
      limit: 25,
      order: 'desc',
      status: 'active',
      search: 'Private'
    });
    expect(host.textContent).not.toContain('Already selected');
    expect(host.textContent).toContain('Selected selected');

    let option = [...host.querySelectorAll('button')].find(
      button => button.textContent === 'Remote Firewall'
    )!;
    await act(async () => option.click());
    expect(state.add).toHaveBeenCalledWith(['selected', 'remote']);
  });

  it('keeps selected rows when no results match, then restores options on clearing', async () => {
    state.search = 'missing';
    state.items = [];
    await render();
    expect(host.textContent).toContain('No matching firewalls found.');
    expect(host.textContent).toContain('Selected selected');

    state.search = undefined;
    state.items = [{ id: 'remote', name: 'Remote Firewall' }];
    await render();
    expect(state.query.search).toBeUndefined();
    expect(host.textContent).toContain('Remote Firewall');
  });
});
