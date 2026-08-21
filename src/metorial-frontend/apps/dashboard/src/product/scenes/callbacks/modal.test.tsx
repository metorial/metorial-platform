import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  createCallback: vi.fn(),
  createCallbackInstance: vi.fn(),
  close: vi.fn(),
  onCreate: vi.fn(),
  setPanelWidth: vi.fn(),
  useIntegrations: vi.fn(),
  useIntegrationInstances: vi.fn()
}));

let mutation = (mutate: ReturnType<typeof vi.fn>) => ({
  mutate,
  isLoading: false,
  RenderError: () => null
});

vi.mock('@metorial/state', () => ({
  useCreateCallback: () => mutation(mocks.createCallback),
  useCreateCallbackInstance: () => mutation(mocks.createCallbackInstance),
  useCreateCallbackReceiverPathSecret: () => mutation(vi.fn()),
  useRotateCallbackReceiverPathSecret: () => mutation(vi.fn()),
  useSendCallbackTestEvent: () => mutation(vi.fn()),
  useProviderListing: (_instanceId: string, providerId: string | null) => ({
    data: providerId ? { name: 'GitHub' } : null
  }),
  useProvider: (_instanceId: string, providerId: string | null) => ({
    data: providerId ? { name: 'GitHub', currentVersion: { id: 'pvr_github' } } : null,
    isLoading: false
  }),
  useProviderDeployment: (_instanceId: string, deploymentId: string | undefined) => ({
    data: deploymentId
      ? {
          id: 'pde_github',
          providerId: 'pro_github',
          lockedVersion: { id: 'pvr_github' }
        }
      : null,
    isLoading: false
  }),
  useProviderTriggers: (_instanceId: string, query: unknown) => ({
    data: query
      ? {
          items: [{ id: 'ptr_issues', key: 'issues.updated', name: 'Issues Updated' }]
        }
      : null,
    isLoading: false
  }),
  useIntegrations: mocks.useIntegrations,
  useIntegrationInstances: mocks.useIntegrationInstances
}));

vi.mock('@metorial/ui', () => ({
  Button: ({
    children,
    loading,
    success: _success,
    variant: _variant,
    size: _size,
    iconLeft: _iconLeft,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    success?: boolean;
    variant?: string;
    size?: string;
    iconLeft?: React.ReactNode;
  }) => (
    <button {...props} disabled={props.disabled || loading}>
      {children}
    </button>
  ),
  Callout: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Copy: ({ value }: { value: string }) => <div>{value}</div>,
  Dialog: {
    Actions: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Wrapper: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Title: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
    Description: ({ children }: React.PropsWithChildren) => <p>{children}</p>
  },
  Flex: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Input: ({
    label: _label,
    description: _description,
    hideLabel: _hideLabel,
    minRows: _minRows,
    size: _size,
    as,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    description?: string;
    hideLabel?: boolean;
    minRows?: number;
    size?: string;
    as?: string;
  }) => (as === 'textarea' ? <textarea {...(props as any)} /> : <input {...props} />),
  Spacer: () => null,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  showModal: vi.fn(),
  theme: {
    colors: new Proxy({}, { get: () => '#000' })
  },
  toast: { error: vi.fn(), success: vi.fn() }
}));

vi.mock('../providerCreationPanel', () => ({
  ProviderCreationPanelShell: ({
    steps,
    currentStep
  }: {
    steps: { render: () => React.ReactNode }[];
    currentStep: number;
  }) => <>{steps[currentStep]!.render()}</>,
  ProviderSelectionStep: ({ onSelect }: { onSelect: (providerId: string) => void }) => (
    <button type="button" onClick={() => onSelect('pro_github')}>
      Choose GitHub
    </button>
  )
}));

vi.mock('./callbackPanel', () => ({
  showCallbackProviderCreationPanel: vi.fn()
}));

vi.mock('./callbackFields', () => ({
  CallbackCompactMultiSelect: ({ summary }: { summary: string }) => <div>{summary}</div>,
  CallbackMaskedValue: () => null
}));

import { CallbackCreatePanelFlow } from './modal';

let root: Root | null = null;

let renderFlow = async () => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(
      <CallbackCreatePanelFlow
        instanceId="ins_authorized"
        close={mocks.close}
        onCreate={mocks.onCreate}
        setPanelWidth={mocks.setPanelWidth}
      />
    );
  });

  return container;
};

let click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};

beforeEach(() => {
  mocks.createCallback
    .mockReset()
    .mockResolvedValue([{ id: 'clb_created', name: 'GitHub · Production' }, null]);
  mocks.createCallbackInstance
    .mockReset()
    .mockResolvedValueOnce([null, new Error('attach failed')])
    .mockResolvedValueOnce([{ id: 'cbi_created' }, null]);
  mocks.close.mockReset();
  mocks.onCreate.mockReset();
  mocks.setPanelWidth.mockReset();
  mocks.useIntegrations.mockReset().mockReturnValue({
    data: { items: [{ id: 'int_active', name: 'Production Integration' }] },
    isLoading: false
  });
  mocks.useIntegrationInstances.mockReset().mockReturnValue({
    data: {
      items: [
        {
          id: 'iti_production',
          name: 'Production',
          integrationId: 'int_active',
          providers: [
            {
              id: 'iip_github',
              status: 'active',
              provider: { id: 'pro_github' },
              integrationProvider: {
                deploymentId: 'pde_github',
                name: 'GitHub'
              },
              config: {
                id: 'pcf_production',
                name: 'Production config',
                updatedAt: new Date('2026-08-15T08:00:00.000Z')
              },
              authConfig: { id: 'pac_production' }
            }
          ]
        }
      ]
    },
    isLoading: false
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

describe('CallbackCreatePanelFlow', () => {
  it('creates from an active config/auth pair and retries only the attach after a partial failure', async () => {
    let container = await renderFlow();

    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Choose GitHub'
      )!
    );

    expect(mocks.useIntegrations).toHaveBeenLastCalledWith('ins_authorized', {
      providerId: 'pro_github',
      status: ['active'],
      order: 'desc',
      limit: 100
    });
    expect(mocks.useIntegrationInstances).toHaveBeenLastCalledWith('ins_authorized', {
      providerId: 'pro_github',
      status: ['active'],
      order: 'desc',
      limit: 100
    });

    await click(
      Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('Production config')
      )!
    );
    expect(container.textContent).toContain('All 1 triggers selected');

    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Create Callback'
      )!
    );

    expect(mocks.createCallback).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      name: 'GitHub · Production',
      providerDeploymentId: 'pde_github',
      triggers: [{ triggerId: 'issues.updated' }]
    });
    expect(mocks.createCallbackInstance).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackId: 'clb_created',
      providerConfigId: 'pcf_production',
      providerAuthConfigId: 'pac_production'
    });
    expect(mocks.onCreate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Finish Setup');

    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Finish Setup'
      )!
    );

    expect(mocks.createCallback).toHaveBeenCalledOnce();
    expect(mocks.createCallbackInstance).toHaveBeenCalledTimes(2);
    expect(mocks.onCreate).toHaveBeenCalledWith({
      id: 'clb_created',
      name: 'GitHub · Production'
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
