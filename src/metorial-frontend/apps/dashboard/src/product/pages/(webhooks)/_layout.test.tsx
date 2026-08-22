/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let mocks = vi.hoisted(() => ({
  callbacksEnabled: true,
  paidCallbacks: true
}));

vi.mock('@metorial/data-hooks', () => ({
  renderWithLoader: (loaders: unknown) => (render: (loaders: unknown) => React.ReactNode) =>
    render(loaders),
  PaginationSearchParamsProvider: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('@metorial/empty-state', () => ({
  ComingSoon: () => <div data-testid="coming-soon">Coming soon</div>,
  Upgrade: () => <div data-testid="upgrade">Upgrade</div>
}));

vi.mock('@metorial/frontend-config', () => ({
  Paths: {
    instance: {
      webhooks: (
        _organization: unknown,
        _project: unknown,
        _instance: unknown,
        page?: string
      ) => `/webhooks/${page ?? ''}`
    }
  }
}));

vi.mock('@metorial/layout', () => ({
  ContentLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));

vi.mock('@metorial/state', () => ({
  useCurrentInstance: () => ({ data: { id: 'ins_test', slug: 'instance' } }),
  useCurrentOrganization: () => ({ data: { id: 'org_test', slug: 'organization' } }),
  useCurrentProject: () => ({ data: { id: 'prj_test', slug: 'project' } }),
  useDashboardFlags: () => ({
    data: {
      flags: {
        'callbacks-enabled': mocks.callbacksEnabled,
        'paid-callbacks': mocks.paidCallbacks
      }
    }
  })
}));

vi.mock('@metorial/ui', () => ({
  LinkTabs: ({ links }: { links: { label: string; to: string }[] }) => (
    <nav data-testid="tabs">
      {links.map(link => (
        <a key={link.to} href={link.to}>
          {link.label}
        </a>
      ))}
    </nav>
  )
}));

import { WebhooksLayout } from './_layout';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

let render = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={['/webhooks/events']}>
        <WebhooksLayout />
      </MemoryRouter>
    );
  });

  return container;
};

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  container?.remove();
  container = null;
  mocks.callbacksEnabled = true;
  mocks.paidCallbacks = true;
});

describe('WebhooksLayout', () => {
  it('renders exactly the Events and Logs tabs', async () => {
    let result = await render();
    let labels = [...result.querySelectorAll('[data-testid="tabs"] a')].map(
      element => element.textContent
    );

    expect(labels).toEqual(['Events', 'Logs']);
  });

  it('hides the activity surface while callbacks are disabled', async () => {
    mocks.callbacksEnabled = false;
    let result = await render();

    expect(result.querySelector('[data-testid="coming-soon"]')).not.toBeNull();
    expect(result.querySelector('[data-testid="tabs"]')).toBeNull();
  });

  it('renders the upgrade surface for unpaid instances', async () => {
    mocks.paidCallbacks = false;
    let result = await render();

    expect(result.querySelector('[data-testid="upgrade"]')).not.toBeNull();
    expect(result.querySelector('[data-testid="tabs"]')).toBeNull();
  });
});
