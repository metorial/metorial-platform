import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackStatus: 'active' as 'active' | 'archived',
  includeSecondTrigger: false,
  providerPublishesEventTypes: true,
  archiveCallback: vi.fn(),
  callbackInstanceStatus: 'attached' as 'attached' | 'detached',
  callbackInstanceHasTriggers: true,
  registrationStatus: 'unregistered',
  triggerSource: 'webhook' as 'webhook' | 'polling',
  pollIntervalSeconds: null as number | null,
  nextPollAt: null as Date | null,
  lastPolledAt: null as Date | null,
  hasActiveSecret: false,
  registrationError: null as null | { code: string; message: string; at: Date },
  createCallbackInstance: vi.fn(),
  refetchCallbackInstances: vi.fn(),
  updateCallback: vi.fn(),
  sendTestEvent: vi.fn(),
  createReceiverPathSecret: vi.fn(),
  rotateReceiverPathSecret: vi.fn(),
  closeModal: vi.fn(),
  capturedModal: null as React.ReactNode,
  providerPanelRenderer: null as
    | null
    | ((p: { close: () => void; setWidth: () => void }) => React.ReactNode),
  addProviderPanelProps: null as null | Record<string, unknown>,
  setSearchParams: vi.fn()
}));

vi.mock('@metorial/data-hooks', async () => {
  let React = await vi.importActual<typeof import('react')>('react');

  return {
    renderWithLoader:
      (loaders: Record<string, unknown>) =>
      (render: (resolved: Record<string, unknown>) => React.ReactNode) =>
        render(loaders),
    useForm: (opts: {
      initialValues: Record<string, string>;
      updateInitialValues?: boolean;
      onSubmit: (values: Record<string, string>) => Promise<void>;
    }) => {
      let [values, setValues] = React.useState(opts.initialValues);
      let initialJson = JSON.stringify(opts.initialValues);

      React.useEffect(() => {
        if (opts.updateInitialValues) setValues(opts.initialValues);
      }, [initialJson]);

      return {
        values,
        handleSubmit: (event?: { preventDefault?: () => void }) => {
          event?.preventDefault?.();
          return opts.onSubmit(values);
        },
        getFieldProps: (name: string) => ({
          name,
          value: values[name] ?? '',
          onChange: (event: { target: { value: string } }) =>
            setValues(current => ({ ...current, [name]: event.target.value }))
        }),
        RenderError: () => null
      };
    }
  };
});

vi.mock('@metorial/state', () => {
  let mutation = (mutate: ReturnType<typeof vi.fn>) => ({
    mutate,
    isLoading: false,
    isSuccess: false,
    RenderError: () => null
  });
  let callbackData = {
    id: 'clb_authorized',
    name: 'Provider · Production',
    description: null,
    updatedAt: new Date('2026-08-15T08:00:00.000Z'),
    providerDeployment: {
      id: 'pde_authorized',
      providerId: 'pro_authorized',
      name: 'Provider deployment'
    },
    providerTriggers: [
      {
        providerTrigger: { key: 'issues.updated' },
        eventTypes: ['issue.closed', 'issue.reopened']
      }
    ]
  };
  let callbackTriggersWithSecond = [
    ...callbackData.providerTriggers,
    {
      providerTrigger: { key: 'issues.created' },
      eventTypes: ['issue.created']
    }
  ];
  let providerTriggers = [
    {
      object: 'provider.capabilities.trigger',
      id: 'ptr_authorized',
      key: 'issues.updated',
      name: 'Issues Updated',
      description: 'Runs when a provider issue changes.',
      inputSchema: null,
      outputSchema: null,
      eventTypes: ['issue.closed', 'issue.reopened', 'issue.labeled'],
      invocation: {
        type: 'webhook',
        autoRegistration: { status: 'supported' },
        autoUnregistration: { status: 'supported' }
      },
      providerId: 'pro_authorized',
      providerSpecificationId: 'psp_authorized',
      createdAt: new Date('2026-08-15T08:00:00.000Z'),
      updatedAt: new Date('2026-08-15T08:00:00.000Z')
    }
  ];
  let providerTriggersWithSecond = [
    ...providerTriggers,
    {
      object: 'provider.capabilities.trigger',
      id: 'ptr_created',
      key: 'issues.created',
      name: 'Issues Created',
      description: 'Runs when a provider issue is created.',
      inputSchema: null,
      outputSchema: null,
      eventTypes: ['issue.created'],
      invocation: {
        type: 'webhook',
        autoRegistration: { status: 'supported' },
        autoUnregistration: { status: 'supported' }
      },
      providerId: 'pro_authorized',
      providerSpecificationId: 'psp_authorized',
      createdAt: new Date('2026-08-15T08:00:00.000Z'),
      updatedAt: new Date('2026-08-15T08:00:00.000Z')
    }
  ];

  return {
    useCurrentInstance: () => ({ data: { id: 'ins_authorized' } }),
    useCallback: () => ({
      data: {
        ...callbackData,
        status: mocks.callbackStatus,
        providerTriggers: mocks.includeSecondTrigger
          ? callbackTriggersWithSecond
          : callbackData.providerTriggers
      },
      isLoading: false,
      refetch: vi.fn(),
      useUpdateMutator: () => mutation(mocks.updateCallback)
    }),
    useCallbackInstances: () => ({
      data: {
        items: [
          {
            id: 'cbi_authorized',
            status: mocks.callbackInstanceStatus,
            registrationStatus: mocks.registrationStatus,
            deployment: { id: 'pde_authorized' },
            config: { id: 'pcf_authorized', name: 'Config' },
            authConfig: null,
            webhookUrl: 'https://receiver.example/callback',
            receiverPathSecret: mocks.hasActiveSecret
              ? {
                  object: 'callback.receiver_path_secret#metadata',
                  id: 'secret-active',
                  generation: 1,
                  createdAt: new Date('2026-08-15T08:00:00.000Z'),
                  updatedAt: new Date('2026-08-15T08:00:00.000Z')
                }
              : null,
            triggers: mocks.callbackInstanceHasTriggers
              ? [
                  {
                    id: 'ctr_authorized',
                    source: mocks.triggerSource,
                    pollIntervalSeconds: mocks.pollIntervalSeconds,
                    nextPollAt: mocks.nextPollAt,
                    lastPolledAt: mocks.lastPolledAt,
                    webhookUrl: 'https://receiver.example/callback',
                    isWebhookRegistered: mocks.registrationStatus !== 'registered',
                    registrationStatus: mocks.registrationStatus,
                    registrationError: mocks.registrationError,
                    registrationGeneration: 2,
                    verificationMechanism: 'hub',
                    verificationSpecHash: 'a'.repeat(64),
                    providerTrigger: {
                      key: 'issues.updated',
                      name: 'Issues Updated'
                    }
                  }
                ]
              : [],
            createdAt: new Date('2026-08-15T08:00:00.000Z'),
            updatedAt: new Date('2026-08-15T08:00:00.000Z')
          }
        ],
        pagination: { hasMoreBefore: false, hasMoreAfter: false }
      },
      isLoading: false,
      refetch: mocks.refetchCallbackInstances,
      useDeleteMutator: () => mutation(vi.fn())
    }),
    useProviderDeployment: () => ({
      data: {
        id: 'pde_authorized',
        providerId: 'pro_authorized',
        lockedVersion: { id: 'pvr_authorized' }
      },
      isLoading: false
    }),
    useProvider: () => ({
      data: {
        id: 'pro_authorized',
        name: 'Provider',
        currentVersion: { id: 'pvr_authorized' }
      },
      isLoading: false
    }),
    useProviderTriggers: () => ({
      data: {
        items: (mocks.includeSecondTrigger
          ? providerTriggersWithSecond
          : providerTriggers
        ).map(trigger =>
          mocks.providerPublishesEventTypes ? trigger : { ...trigger, eventTypes: undefined }
        )
      },
      isLoading: false
    }),
    useIntegrations: () => ({ data: { items: [] }, isLoading: false }),
    useIntegrationInstances: () => ({ data: { items: [] }, isLoading: false }),
    useCreateCallbackInstance: () => mutation(mocks.createCallbackInstance),
    useCreateCallbackReceiverPathSecret: () => mutation(mocks.createReceiverPathSecret),
    useRotateCallbackReceiverPathSecret: () => mutation(mocks.rotateReceiverPathSecret),
    useSendCallbackTestEvent: () => mutation(mocks.sendTestEvent),
    useCreateCallback: () => mutation(vi.fn()),
    useArchiveCallback: () => mutation(mocks.archiveCallback),
    useCreateProviderDeployment: () => mutation(vi.fn()),
    useProviderDeployments: () => ({ data: { items: [] }, isLoading: false })
  };
});

vi.mock('@metorial/ui', async () => {
  let React = await vi.importActual<typeof import('react')>('react');
  let wrapper =
    (name: string) =>
    ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('div', { 'data-component': name, ...props }, children);
  let Button = ({ children, loading: _loading, success: _success, ...props }: any) => (
    <button {...props}>{children}</button>
  );
  let Input = ({ label, as, minRows: _minRows, ...props }: any) => {
    let element = as === 'textarea' ? 'textarea' : 'input';
    return React.createElement(element, { 'aria-label': label, ...props });
  };
  let Dialog = {
    Wrapper: wrapper('dialog'),
    Title: wrapper('dialog-title'),
    Description: wrapper('dialog-description'),
    Actions: wrapper('dialog-actions')
  };
  let Panel = {
    Header: wrapper('panel-header'),
    Title: wrapper('panel-title'),
    Content: wrapper('panel-content')
  };

  return {
    Attributes: ({ attributes }: any) => (
      <dl data-component="attributes">
        {attributes.map((attribute: any) => (
          <div key={attribute.label}>
            <dt>{attribute.label}</dt>
            <dd>{attribute.content}</dd>
          </div>
        ))}
      </dl>
    ),
    Badge: wrapper('badge'),
    Button,
    Callout: wrapper('callout'),
    Copy: ({ value, label }: { value: string; label?: string }) => (
      <span data-component="copy" data-copy-value={value}>
        {label ? `${label}: ` : ''}
        {value}
      </span>
    ),
    Datalist: ({ items }: any) => (
      <div>
        {items.map((item: any) => (
          <div key={item.label}>
            {item.label}: {item.value}
          </div>
        ))}
      </div>
    ),
    Dialog,
    Flex: wrapper('flex'),
    InlineCopy: ({ value }: { value: string }) => <span>{value}</span>,
    Input,
    MultiSelect: ({ label, value, onChange, items }: any) => (
      <select
        aria-label={label}
        multiple
        value={value}
        onChange={event =>
          onChange(Array.from(event.currentTarget.selectedOptions).map(option => option.value))
        }
      >
        {items.map((item: any) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    ),
    Panel,
    RenderDate: ({ date }: { date: Date }) => <time>{date.toISOString()}</time>,
    Select: ({ label, value, onChange, items }: any) => (
      <select
        aria-label={label}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
      >
        {items.map((item: any) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    ),
    Spacer: ({ height, size }: { height?: number; size?: number }) => (
      <div data-component="spacer" data-height={height ?? size} />
    ),
    Text: wrapper('text'),
    TextArrayInput: ({ label, description, value, onChange }: any) => (
      <div>
        {description ? <span>{description}</span> : null}
        <input
          aria-label={label}
          value={value.join(',')}
          onChange={event => onChange(event.currentTarget.value.split(','))}
        />
      </div>
    ),
    confirm: vi.fn(),
    showModal: (render: any) => {
      mocks.capturedModal = render({ dialogProps: {}, close: mocks.closeModal });
    },
    theme: {
      colors: new Proxy({}, { get: (_target, key) => `var(--${String(key)})` }) as Record<
        string,
        string
      >
    },
    toast: { error: vi.fn(), success: vi.fn() }
  };
});

vi.mock('./callbackFields', () => ({
  CallbackMaskedValue: ({ value, label }: { value: string; label?: string }) => (
    <span data-component="callback-masked-value" data-value={value}>
      {label ? `${label}: ` : ''}
      {value}
    </span>
  ),
  CallbackCompactMultiSelect: ({ label, value, onChange, items, disabled }: any) => (
    <select
      aria-label={label}
      multiple
      value={value}
      disabled={disabled}
      onChange={event =>
        onChange(Array.from(event.currentTarget.selectedOptions).map(option => option.value))
      }
    >
      {items.map((item: any) => (
        <option key={item.id} value={item.id} disabled={item.disabled}>
          {item.label}
        </option>
      ))}
    </select>
  )
}));

vi.mock('@metorial/ui-product', () => ({
  Box: ({
    title,
    description,
    children,
    rightActions
  }: React.PropsWithChildren<{
    title: string;
    description?: React.ReactNode;
    rightActions?: React.ReactNode;
  }>) => (
    <section data-box-title={title}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {rightActions}
      {children}
    </section>
  ),
  ID: ({ id }: { id: string }) => <span>{id}</span>,
  Table: ({ headers = [], data }: any) => (
    <div>
      <div>
        {headers.map((header: React.ReactNode, index: number) => (
          <span key={index}>{header}</span>
        ))}
      </div>
      {data.map((row: any, index: number) => (
        <div key={index} onClick={row.onClick}>
          {row.data.map((cell: React.ReactNode, cellIndex: number) => (
            <span key={cellIndex}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  )
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams]
}));

vi.mock('../providerCreationPanel', () => ({
  ProviderCreationPanelShell: ({ children }: React.PropsWithChildren) => <>{children}</>,
  ProviderSelectionStep: () => null
}));

vi.mock('./callbackPanel', () => ({
  showCallbackProviderCreationPanel: vi.fn((renderer: any) => {
    mocks.providerPanelRenderer = renderer;
  })
}));

vi.mock('../routerPanel', () => ({
  RouterPanel: ({ children }: { children: (id: string) => React.ReactNode }) => (
    <div>{children('cbi_authorized')}</div>
  )
}));

vi.mock('../sessionTemplates/addProviderPanelFlow', () => ({
  AddProviderPanelFlow: (props: Record<string, unknown>) => {
    mocks.addProviderPanelProps = props;
    return <div>Provider attachment flow</div>;
  }
}));

import { confirm } from '@metorial/ui';
import { showCallbackSecretSetupModal, showCallbackTestEventModal } from './modal';
import { CallbackOverview } from './overview';
import { CallbackSettings } from './settings';
import { CallbackTriggersList } from './triggers';

let root: Root | null = null;

let render = async (node: React.ReactNode) => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  return container;
};

let changeValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    let descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value'
    );
    descriptor!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

let changeMultiSelect = async (element: HTMLSelectElement, values: string[]) => {
  await act(async () => {
    Array.from(element.options).forEach(option => {
      option.selected = values.includes(option.value);
    });
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

let click = async (element: HTMLElement) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

beforeEach(() => {
  mocks.callbackStatus = 'active';
  mocks.includeSecondTrigger = false;
  mocks.providerPublishesEventTypes = true;
  mocks.archiveCallback
    .mockReset()
    .mockResolvedValue([{ id: 'clb_authorized', status: 'archived' }, null]);
  mocks.callbackInstanceStatus = 'attached';
  mocks.callbackInstanceHasTriggers = true;
  mocks.registrationStatus = 'unregistered';
  mocks.triggerSource = 'webhook';
  mocks.pollIntervalSeconds = null;
  mocks.nextPollAt = null;
  mocks.lastPolledAt = null;
  mocks.hasActiveSecret = false;
  mocks.registrationError = null;
  mocks.capturedModal = null;
  mocks.providerPanelRenderer = null;
  mocks.addProviderPanelProps = null;
  mocks.updateCallback.mockReset().mockResolvedValue([{ id: 'clb_authorized' }, null]);
  mocks.createCallbackInstance.mockReset().mockResolvedValue([{ id: 'cbi_authorized' }, null]);
  mocks.refetchCallbackInstances.mockReset();
  mocks.sendTestEvent.mockReset().mockResolvedValue([{ id: 'cbe_authorized' }, null]);
  mocks.createReceiverPathSecret.mockReset().mockResolvedValue([
    {
      object: 'callback.receiver_path_secret',
      id: 'csr_authorized',
      generation: 1,
      value: 'generated secret'
    },
    null
  ]);
  mocks.rotateReceiverPathSecret.mockReset().mockResolvedValue([null, new Error('stopped')]);
  mocks.closeModal.mockReset();
  vi.mocked(confirm).mockClear();
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe('callback overview production editor', () => {
  it('does not poll merely because attached registrations are empty', async () => {
    vi.useFakeTimers();
    try {
      mocks.callbackInstanceHasTriggers = false;
      await render(<CallbackOverview callbackId="clb_authorized" />);

      await act(async () => vi.advanceTimersByTimeAsync(12_000));

      expect(mocks.refetchCallbackInstances).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds reconciliation polling after reattaching an instance', async () => {
    vi.useFakeTimers();
    try {
      mocks.callbackInstanceStatus = 'detached';
      let container = await render(<CallbackOverview callbackId="clb_authorized" />);
      let reattach = Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Reattach Instance'
      )!;

      await click(reattach);
      mocks.refetchCallbackInstances.mockClear();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await act(async () => vi.advanceTimersByTimeAsync(3_000));
      }
      expect(mocks.refetchCallbackInstances).toHaveBeenCalledTimes(10);

      await act(async () => vi.advanceTimersByTimeAsync(3_000));
      expect(mocks.refetchCallbackInstances).toHaveBeenCalledTimes(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops reconciliation polling when the reattached instance becomes ready', async () => {
    vi.useFakeTimers();
    try {
      mocks.callbackInstanceStatus = 'detached';
      let container = await render(<CallbackOverview callbackId="clb_authorized" />);
      let reattach = Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Reattach Instance'
      )!;

      await click(reattach);
      mocks.refetchCallbackInstances.mockClear();
      await act(async () => vi.advanceTimersByTimeAsync(3_000));
      expect(mocks.refetchCallbackInstances).toHaveBeenCalledTimes(1);

      mocks.callbackInstanceStatus = 'attached';
      await act(async () => {
        root!.render(<CallbackOverview callbackId="clb_authorized" />);
      });
      await act(async () => vi.advanceTimersByTimeAsync(6_000));

      expect(mocks.refetchCallbackInstances).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('only shows the detach danger action for attached instances', async () => {
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);

    expect(container.querySelector('[data-box-title="Danger Zone"]')).not.toBeNull();
    expect(container.textContent).toContain('Detach Instance');
    expect(container.textContent).not.toContain('Reattach Instance');
  });

  it('distills detached instance details to identity and recovery', async () => {
    mocks.callbackInstanceStatus = 'detached';
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    let instanceDetails = container.querySelector('[data-box-title="Instance"]')!;
    let reattach = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Reattach Instance'
    )!;

    expect(container.querySelector('[data-box-title="Danger Zone"]')).toBeNull();
    expect(container.querySelector('[data-box-title="Detached Instance"]')).toBeNull();
    expect(container.querySelector('[data-box-title="Trigger Registrations"]')).toBeNull();
    expect(container.querySelector('[data-box-title="Secure callback setup"]')).toBeNull();
    expect(container.querySelector('[data-box-title="Manual Setup Required"]')).toBeNull();
    expect(container.textContent).not.toContain('Detach Instance');
    expect(instanceDetails.textContent).toContain('Reattach Instance');
    expect(instanceDetails.textContent).toContain(
      'is detached and its Provider events are not routed'
    );

    await click(reattach);

    expect(mocks.createCallbackInstance).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      providerConfigId: 'pcf_authorized',
      providerAuthConfigId: undefined
    });
    expect(mocks.refetchCallbackInstances).toHaveBeenCalled();
  });

  it('shows attached instances without a callback-wide polling timestamp', async () => {
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    let summary = container.querySelector('[data-component="attributes"]');

    expect(summary?.textContent).toContain('Instances1');
    expect(summary?.textContent).not.toContain('Next Poll At');
  });

  it('requires a config selection and rejects a duplicate config/auth pair', async () => {
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    expect(container.textContent).toContain('Config');
    expect(container.textContent).toContain('pcf_authorized');

    let attach = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Attach Instance'
    )!;
    await click(attach);
    expect(mocks.providerPanelRenderer).not.toBeNull();

    await act(async () => root!.unmount());
    root = null;
    document.body.replaceChildren();

    let panel = mocks.providerPanelRenderer!({ close: vi.fn(), setWidth: vi.fn() });
    await render(panel);

    expect(mocks.addProviderPanelProps).toMatchObject({
      ensureProviderConfig: true,
      filterAvailableResources: true,
      showToolFilters: false
    });
    expect(mocks.addProviderPanelProps).not.toHaveProperty('autoSubmitWhenReady');

    let submit = mocks.addProviderPanelProps!.onSubmitProvider as (
      input: Record<string, string>
    ) => Promise<{ success: boolean; error?: Error }>;
    let duplicate = await submit({
      providerConfigId: 'pcf_authorized',
      providerAuthConfigId: ''
    });

    expect(duplicate.success).toBe(false);
    expect(duplicate.error?.message).toContain('already attached');
    expect(mocks.createCallbackInstance).not.toHaveBeenCalled();
  });

  it('keeps trigger selection focused without rendering event filter inputs', async () => {
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);

    expect(
      container.querySelector('input[aria-label="Issues Updated Event Types"]')
    ).toBeNull();
  });
});

describe('callback trigger event filters', () => {
  it('renders missing provider event types without crashing', async () => {
    mocks.providerPublishesEventTypes = false;
    let container = await render(<CallbackTriggersList callbackId="clb_authorized" />);

    expect(container.textContent).toContain('All events');
    expect(container.textContent).toContain('View Details');
    expect(container.textContent).not.toContain('Configure Events');

    let viewDetails = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'View Details'
    )!;
    await click(viewDetails);

    await act(async () => root!.unmount());
    root = null;
    document.body.replaceChildren();

    container = await render(mocks.capturedModal);
    expect(container.textContent).toContain(
      'This integration does not publish event types for this trigger yet.'
    );
    expect(container.querySelector('select[aria-label="Event types"]')).toBeNull();
  });

  it('edits one trigger in its details without dropping the other trigger settings', async () => {
    mocks.includeSecondTrigger = true;
    let container = await render(<CallbackTriggersList callbackId="clb_authorized" />);

    expect(container.textContent).toContain('Event Filters');
    expect(container.textContent).not.toContain(
      'By default, each trigger receives all provider events.'
    );
    expect(container.textContent).toContain('2 of 3 event types');
    expect(container.textContent).not.toContain('issue.closed, issue.reopened');

    let configure = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Configure Events'
    )!;
    expect(configure.getAttribute('aria-label')).toBe('Configure events for Issues Updated');

    await click(configure);
    expect(mocks.capturedModal).not.toBeNull();

    await act(async () => root!.unmount());
    root = null;
    document.body.replaceChildren();

    container = await render(mocks.capturedModal);
    let eventTypes = container.querySelector(
      'select[aria-label="Event types"]'
    ) as HTMLSelectElement;
    expect(Array.from(eventTypes.selectedOptions).map(option => option.value)).toEqual([
      'issue.closed',
      'issue.reopened'
    ]);
    expect(Array.from(eventTypes.options).map(option => option.value)).toEqual([
      'issue.closed',
      'issue.reopened',
      'issue.labeled'
    ]);
    expect(container.textContent).toContain('Events filters (Optional)');
    expect(container.textContent!.indexOf('Events filters (Optional)')).toBeGreaterThan(
      container.textContent!.indexOf('Invocation')
    );

    await changeMultiSelect(eventTypes, ['issue.labeled', 'issue.reopened']);
    let save = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Save Selection'
    )!;
    await click(save);

    expect(mocks.updateCallback).toHaveBeenCalledWith({
      triggers: [
        {
          triggerId: 'issues.updated',
          eventTypes: ['issue.reopened', 'issue.labeled']
        },
        {
          triggerId: 'issues.created',
          eventTypes: ['issue.created']
        }
      ]
    });
    expect(mocks.closeModal).toHaveBeenCalled();
  });

  it('stores an all-types selection as the receive-all setting', async () => {
    let container = await render(<CallbackTriggersList callbackId="clb_authorized" />);
    let configure = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Configure Events'
    )!;

    await click(configure);
    await act(async () => root!.unmount());
    root = null;
    document.body.replaceChildren();

    container = await render(mocks.capturedModal);
    let eventTypes = container.querySelector(
      'select[aria-label="Event types"]'
    ) as HTMLSelectElement;
    await changeMultiSelect(eventTypes, ['issue.closed', 'issue.reopened', 'issue.labeled']);
    let save = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Save Selection'
    )!;
    await click(save);

    expect(mocks.updateCallback).toHaveBeenCalledWith({
      triggers: [{ triggerId: 'issues.updated', eventTypes: [] }]
    });
  });

  it('keeps archived trigger filters read-only', async () => {
    mocks.callbackStatus = 'archived';
    let container = await render(<CallbackTriggersList callbackId="clb_authorized" />);

    expect(container.textContent).toContain('available for reference but cannot be changed');
    expect(container.textContent).toContain('View Details');
    expect(container.textContent).not.toContain('Configure Events');

    let viewDetails = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'View Details'
    )!;
    await click(viewDetails);

    await act(async () => root!.unmount());
    root = null;
    document.body.replaceChildren();

    container = await render(mocks.capturedModal);
    expect(container.textContent).toContain('event type selection is read-only');
    expect(container.querySelector('select[aria-label="Event types"]')).toBeNull();
  });
});

describe('callback overview authoritative registration rendering', () => {
  it('renders webhook registrations as event-driven without polling dates', async () => {
    mocks.registrationStatus = 'registered';
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    let registrations = container.querySelector('[data-box-title="Trigger Registrations"]');

    expect(registrations?.textContent).toContain('Type');
    expect(registrations?.textContent).toContain('State');
    expect(registrations?.textContent).toContain('Schedule');
    expect(registrations?.textContent).toContain('Webhook');
    expect(registrations?.textContent).toContain('Registered');
    expect(registrations?.textContent).toContain('Event-driven');
    expect(registrations?.textContent).not.toContain('Next poll');
  });

  it('renders polling timing on the owning trigger registration', async () => {
    mocks.triggerSource = 'polling';
    mocks.pollIntervalSeconds = 60;
    mocks.nextPollAt = new Date('2026-08-18T13:01:00.000Z');
    mocks.lastPolledAt = new Date('2026-08-18T13:00:00.000Z');
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    let registrations = container.querySelector('[data-box-title="Trigger Registrations"]');

    expect(registrations?.textContent).toContain('Polling');
    expect(registrations?.textContent).toContain('Scheduled');
    expect(registrations?.textContent).not.toContain('Unregistered');
    expect(registrations?.textContent).toContain('Every minute');
    expect(registrations?.textContent).toContain('Next poll: 2026-08-18T13:01:00.000Z');
    expect(registrations?.textContent).toContain('Last poll: 2026-08-18T13:00:00.000Z');
  });

  it.each([false, true])(
    'renders the %s path-secret state as a masked, non-copyable URL',
    async hasActiveSecret => {
      mocks.hasActiveSecret = hasActiveSecret;
      let container = await render(<CallbackOverview callbackId="clb_authorized" />);
      let url = container.querySelector('[data-component="callback-masked-value"]');

      expect(url?.getAttribute('data-value')).toBe(
        'https://receiver.example/callback/••••••••'
      );
      expect(container.querySelector('[data-component="copy"]')).toBeNull();
      expect(container.textContent).not.toContain('<create-secret>');
    }
  );

  it.each([
    ['pending', true],
    ['registering', true],
    ['registered', false],
    ['renewing', true],
    ['unregistering', true],
    ['unregistered', true],
    ['failed', true],
    ['tombstoned', true]
  ])('renders manual setup for %s = %s', async (status, visible) => {
    mocks.registrationStatus = status;
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);

    expect(Boolean(container.querySelector('[data-box-title="Manual Setup Required"]'))).toBe(
      visible
    );
  });

  it('shows renewal failure detail', async () => {
    mocks.registrationStatus = 'renewing';
    mocks.registrationError = {
      code: 'renewal_failed',
      message: 'Provider rejected renewal',
      at: new Date('2026-08-15T09:00:00.000Z')
    };
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);
    expect(container.textContent).toContain(
      'renewal_failed: Provider rejected renewal at 2026-08-15T09:00:00.000Z'
    );
  });
});

describe('callback secure URL disclosure', () => {
  it('only enables copying after revealing the generated URL', async () => {
    showCallbackSecretSetupModal({
      mode: 'create',
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      callbackInstanceId: 'cbi_authorized',
      receiverUrl: 'https://receiver.example/callback',
      onComplete: vi.fn()
    });
    let container = await render(mocks.capturedModal);
    let preview = container.querySelector('[data-component="callback-masked-value"]');

    expect(preview?.getAttribute('data-value')).toBe(
      'https://receiver.example/callback/••••••••'
    );
    expect(container.querySelector('[data-component="copy"]')).toBeNull();

    let create = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Create and reveal once'
    )!;
    await click(create);

    let revealed = container.querySelector('[data-component="copy"]');
    expect(revealed?.getAttribute('data-copy-value')).toBe(
      'https://receiver.example/callback/generated%20secret'
    );
    expect(container.querySelector('[data-component="callback-masked-value"]')).toBeNull();

    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Done'
      )!
    );
    expect(mocks.closeModal).toHaveBeenCalledOnce();

    await act(async () => root!.unmount());
    root = null;
    expect(document.body.textContent).not.toContain('generated secret');
  });

  it('rotates immediately and reveals the returned URL only in the open dialog', async () => {
    mocks.rotateReceiverPathSecret.mockResolvedValue([
      {
        object: 'callback.receiver_path_secret',
        id: 'csr_rotated',
        generation: 2,
        value: 'rotated secret',
        webhookUrl: 'https://receiver.example/callback/rotated-secret'
      },
      null
    ]);
    showCallbackSecretSetupModal({
      mode: 'rotate',
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      callbackInstanceId: 'cbi_authorized',
      receiverUrl: 'https://receiver.example/callback',
      onComplete: vi.fn()
    });
    let container = await render(mocks.capturedModal);
    let rotate = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Rotate and reveal once'
    )!;

    await click(rotate);

    expect(mocks.rotateReceiverPathSecret).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      callbackInstanceId: 'cbi_authorized'
    });
    expect(
      container.querySelector('[data-component="copy"]')?.getAttribute('data-copy-value')
    ).toBe('https://receiver.example/callback/rotated-secret');
    expect(container.textContent).toContain(
      'The previous URL was revoked immediately and is no longer accepted.'
    );
    await click(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Done'
      )!
    );
    expect(mocks.closeModal).toHaveBeenCalledOnce();

    await act(async () => root!.unmount());
    root = null;
    expect(document.body.textContent).not.toContain('rotated-secret');
  });
});

describe('callback settings', () => {
  it('renames the callback from the general box', async () => {
    let container = await render(<CallbackSettings callbackId="clb_authorized" />);
    let nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Provider · Production');

    await changeValue(nameInput, 'Renamed Callback');
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mocks.updateCallback).toHaveBeenCalledWith({
      name: 'Renamed Callback',
      description: ''
    });
  });

  it('archives through confirm and refreshes the callback', async () => {
    let container = await render(<CallbackSettings callbackId="clb_authorized" />);
    let archive = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Archive Callback'
    )!;
    expect(archive).toBeTruthy();

    await click(archive);
    let confirmCall = vi.mocked(confirm).mock.calls.at(-1)![0];
    expect(confirmCall.title).toBe('Archive callback');
    expect(confirmCall.confirmText).toBe('Archive');
    await act(async () => {
      await confirmCall.onConfirm();
    });

    expect(mocks.archiveCallback).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized'
    });
  });

  it('locks down an archived callback instead of offering mutations', async () => {
    mocks.callbackStatus = 'archived';
    let container = await render(<CallbackOverview callbackId="clb_authorized" />);

    expect(container.textContent).toContain('This callback is archived');
    expect(container.textContent).toContain('can no longer be changed');
    expect(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Attach Instance'
      )
    ).toBeUndefined();
    expect(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Save Triggers'
      )
    ).toBeUndefined();
    expect(container.textContent).not.toContain('Manual Setup Required');
    expect(container.textContent).not.toContain('Send Test Event');
    expect(container.textContent).not.toContain('Create secure URL');
    expect(container.textContent).not.toContain('Rotate secret');
    expect(container.textContent).not.toContain('Detach Instance');

    mocks.callbackInstanceStatus = 'detached';
    await act(async () => {
      root!.render(<CallbackOverview callbackId="clb_authorized" />);
    });
    expect(container.textContent).not.toContain('Reattach Instance');
  });

  it('replaces archived settings with the archived notice', async () => {
    mocks.callbackStatus = 'archived';
    let container = await render(<CallbackSettings callbackId="clb_authorized" />);

    expect(container.textContent).toContain('This callback is archived');
    expect(container.querySelector('form')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('button')).find(
        button => button.textContent === 'Archive Callback'
      )
    ).toBeUndefined();
  });
});

describe('callback synthetic event production modal', () => {
  it('submits through the authenticated state mutator without a receiver fetch', async () => {
    showCallbackTestEventModal({
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      callbackInstanceId: 'cbi_authorized'
    });
    expect(mocks.capturedModal).not.toBeNull();
    let container = await render(mocks.capturedModal);
    let eventType = container.querySelector('[aria-label="Event Type"]') as HTMLInputElement;
    let payload = container.querySelector(
      '[aria-label="JSON Payload"]'
    ) as HTMLTextAreaElement;
    let send = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Send Test Event'
    )!;

    await changeValue(eventType, 'issues.synthetic');
    await changeValue(payload, '{"issue":{"id":42}}');
    await click(send);

    expect(mocks.sendTestEvent).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackId: 'clb_authorized',
      callbackInstanceId: 'cbi_authorized',
      eventType: 'issues.synthetic',
      payload: { issue: { id: 42 } }
    });
    expect(mocks.closeModal).toHaveBeenCalledOnce();
  });
});
