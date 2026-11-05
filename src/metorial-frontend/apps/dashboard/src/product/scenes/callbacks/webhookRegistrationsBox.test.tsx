import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProviderWebhookRegistrationsBox } from './webhookRegistrationsBox';

let state = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn() }));

vi.mock('./shared', () => ({ truncateReceiverUrl: (url: string) => url }));

vi.mock('@metorial/state', () => ({
  useCurrentOrganization: () => ({ data: {} }),
  useCurrentProject: () => ({ data: {} }),
  useCurrentInstance: () => ({ data: {} }),
  useWebhookRegistrations: (_instanceId: string, query: any) => {
    state.query(query);

    let items = [
      { id: 'receiver_1', name: 'App 1 Receiver', credentialId: 'app_1', status: 'active' },
      { id: 'receiver_2', name: 'Shared Receiver', credentialId: null, status: 'active' }
    ].filter(item =>
      query.isShared
        ? item.credentialId === null
        : item.credentialId === query.providerAuthCredentialsId
    );

    return { data: { items }, refetch: vi.fn() };
  }
}));

vi.mock('@metorial/frontend-config', () => ({
  Paths: { instance: { webhookRegistration: () => '/receiver' } }
}));

vi.mock('@metorial/data-hooks', () => ({
  renderWithPagination: (loader: any, options: any) => (render: any) =>
    loader.data.items.length ? render(loader) : options.emptyState
}));

vi.mock('@metorial/ui', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
  Callout: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  Spacer: () => null
}));

vi.mock('@metorial/ui-product', () => ({
  Box: ({ children, rightActions }: any) => (
    <div>
      {rightActions}
      {children}
    </div>
  ),
  Table: ({ data }: any) => (
    <div>
      {data.map((row: any, index: number) => (
        <div key={index}>{row.data}</div>
      ))}
    </div>
  )
}));

vi.mock('./webhookRegistrationsTable', () => ({
  CreateWebhookRegistrationButton: (props: any) => {
    state.create(props);
    return <button>Create Webhook Receiver</button>;
  }
}));

describe('chat app receiver isolation', () => {
  it('shows app 1 receiver only for app 1 and allows app 2 to create its own', () => {
    let render = (credentialId: string) =>
      renderToStaticMarkup(
        <ProviderWebhookRegistrationsBox
          instanceId="instance"
          provider={{ id: 'slack', name: 'Slack' }}
          providerAuthCredentialsId={credentialId}
        />
      );

    let app1 = render('app_1');
    expect(app1).toContain('App 1 Receiver');
    expect(app1).not.toContain('Create Webhook Receiver');

    let app2 = render('app_2');
    expect(app2).not.toContain('App 1 Receiver');
    expect(app2).toContain('Create Webhook Receiver');
    expect(state.query).toHaveBeenLastCalledWith({
      order: 'desc',
      providerId: 'slack',
      providerAuthCredentialsId: 'app_2',
      status: ['awaiting_setup', 'active']
    });
    expect(state.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instanceId: 'instance',
        providerAuthCredentialsId: 'app_2'
      })
    );
  });

  it('shows only shared receivers when the connection has no app credentials', () => {
    let html = renderToStaticMarkup(
      <ProviderWebhookRegistrationsBox
        instanceId="instance"
        provider={{ id: 'slack', name: 'Slack' }}
      />
    );

    expect(html).toContain('Shared Receiver');
    expect(html).not.toContain('App 1 Receiver');
    expect(state.query).toHaveBeenLastCalledWith({
      order: 'desc',
      providerId: 'slack',
      isShared: true,
      status: ['awaiting_setup', 'active']
    });
  });
});
