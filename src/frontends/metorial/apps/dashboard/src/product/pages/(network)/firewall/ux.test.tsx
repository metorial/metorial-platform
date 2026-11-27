// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleWizard } from './ruleWizard';
import { ruleValues } from './ruleEditor';
import { showApplyFirewallPanel } from '../_applyFirewallPanel';
import { NetworkFirewallPage } from './index';

let state = vi.hoisted(() => ({
  modal: null as any,
  close: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  createPolicy: vi.fn(),
  attachPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  bindings: [] as any[],
  policies: [] as any[],
  firewallQueries: [] as any[],
  next: vi.fn(),
  previous: vi.fn()
}));

vi.mock('@metorial/data-hooks', async () => {
  let { useForm } = await import('../../../../../../../packages/data-hooks/src/useForm');
  return { useForm, renderWithLoader: (loaders: any) => (render: any) => render(loaders) };
});

vi.mock('@metorial/use-debounced', () => ({ useDebounced: (value: any) => value }));

vi.mock('@metorial/details-layout', () => ({
  DetailsOverviewLayout: ({ children }: any) => <div>{children}</div>
}));
vi.mock('../_common', () => ({
  statusBadge: (status: string) => <span>{status}</span>,
  EmptyText: ({ children }: any) => <p>{children}</p>
}));
vi.mock('../_gate', () => ({ useNetworkManagementAccess: () => ({ canWrite: true }) }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ firewallId: 'fw' }) }));
vi.mock('@metorial/ui-product', () => ({
  Box: ({ title, children, rightActions }: any) => (
    <section>
      <h2>{title}</h2>
      {rightActions}
      {children}
    </section>
  )
}));
vi.mock('@metorial/explainer', () => ({
  Stepper: ({ steps, currentStep, setCurrentStep }: any) => (
    <div>
      {steps.map((step: any, index: number) => (
        <button key={step.title} onClick={() => setCurrentStep(index)}>
          {step.title}
        </button>
      ))}
      {steps[currentStep].render()}
    </div>
  )
}));

vi.mock('@metorial/state', () => {
  let mutator = (mutate: any) => ({
    mutate,
    isLoading: false,
    isSuccess: false,
    RenderError: () => null
  });
  return {
    useCurrentInstance: () => ({ data: { id: 'instance' } }),
    useFirewalls: (_instance: string, query: any) => {
      state.firewallQueries.push(query);
      let items = [
        { id: 'active', name: 'Active Firewall', status: 'active', networkPolicies: [] },
        { id: 'archived', name: 'Archived Firewall', status: 'archived', networkPolicies: [] },
        {
          id: 'remote',
          name: 'Remote Firewall',
          description: 'Private traffic',
          status: 'active',
          networkPolicies: []
        }
      ];
      return {
        data: {
          items: query.search
            ? items.filter(item => item.description?.includes(query.search))
            : items.slice(0, 2),
          pagination: { hasMoreBefore: false, hasMoreAfter: !query.search }
        },
        next: state.next,
        previous: state.previous
      };
    },
    useIntegrationFirewallAssignments: () => ({ data: { items: state.bindings } }),
    useCreateIntegrationFirewallAssignment: () => mutator(state.create),
    useDeleteIntegrationFirewallAssignment: () => mutator(state.remove),
    useCreateNetworkPolicy: () => mutator(state.createPolicy),
    useAttachNetworkPolicyToFirewall: () => mutator(state.attachPolicy),
    useDetachNetworkPolicyFromFirewall: () => mutator(vi.fn()),
    useFirewall: () => ({
      data: { id: 'fw', networkPolicies: state.policies },
      refetch: vi.fn()
    }),
    useNetworkPolicy: (_instance: string, id: string) => ({
      data: state.policies.find(policy => policy.id === id),
      useDeleteRuleMutator: () => mutator(vi.fn()),
      useUpdateMutator: () => mutator(state.updatePolicy),
      useCreateRuleMutator: () => mutator(vi.fn()),
      useUpdateRuleMutator: () => mutator(vi.fn())
    })
  };
});

vi.mock('@metorial/ui', () => {
  let Container = ({ children }: any) => <div>{children}</div>;
  return {
    theme: { colors: { gray100: '#eee', gray200: '#ddd', gray300: '#ccc', gray700: '#444' } },
    Text: ({ children, as: Tag = 'span' }: any) => <Tag>{children}</Tag>,
    Title: ({ children }: any) => <h3>{children}</h3>,
    Error: ({ children }: any) => <p role="alert">{children}</p>,
    Input: ({ label, description, ...props }: any) => (
      <label>
        {label}
        <input {...props} />
        {description}
      </label>
    ),
    Select: ({ label, items, value, onChange }: any) => (
      <label>
        {label}
        <select value={value} onChange={event => onChange(event.target.value)}>
          {items.map((item: any) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    ),
    Button: ({ children, type = 'button', onClick, disabled, loading, title }: any) => (
      <button type={type} onClick={onClick} disabled={disabled || loading} title={title}>
        {children}
      </button>
    ),
    Checkbox: ({ checked }: any) => (
      <span data-testid="checkbox-indicator">{checked ? '✓' : '□'}</span>
    ),
    Badge: Container,
    Spacer: () => null,
    Menu: ({ children }: any) => <div>{children}</div>,
    Dialog: {
      Wrapper: Container,
      Title: Container,
      Description: Container,
      Actions: Container
    },
    Panel: {
      Wrapper: Container,
      Header: Container,
      Title: Container,
      Description: Container,
      Content: Container
    },
    showModal: (modal: any) => {
      state.modal = modal;
    }
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  state.bindings = [];
  state.firewallQueries = [];
  state.policies = [];
  state.create.mockResolvedValue([
    { id: 'binding', firewall: { id: 'active' }, target: { id: 'gateway' } },
    null
  ]);
  state.remove.mockResolvedValue([{}, null]);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

let render = async (content: React.ReactNode) => act(async () => root.render(content));
let click = async (element: Element) => act(async () => (element as HTMLElement).click());
let button = (label: string) =>
  [...host.querySelectorAll('button')].find(button => button.textContent === label)!;
let field = (label: string) =>
  [...host.querySelectorAll('label')]
    .find(element => element.textContent?.startsWith(label))!
    .querySelector('input')!;
let fill = async (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      value
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
let submit = async () =>
  act(async () => {
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

let openPanel = async () => {
  showApplyFirewallPanel({
    instanceId: 'instance',
    targetType: 'internet_gateway',
    targetId: 'gateway',
    title: 'Apply Firewall',
    description: '',
    onComplete: vi.fn()
  });
  let Modal = state.modal;
  await render(<Modal dialogProps={{}} close={state.close} />);
};

describe('Apply Firewall selection', () => {
  it('searches descriptions beyond the initial page and restores applied state on clearing', async () => {
    await openPanel();
    await click(host.querySelector('[role="checkbox"]')!);
    await fill(field('Search Firewalls'), 'Private');

    expect(state.firewallQueries.at(-1)).toMatchObject({ search: 'Private', limit: 25 });
    expect(host.textContent).toContain('Remote Firewall');
    expect(host.textContent).not.toContain('Active Firewall');
    await fill(field('Search Firewalls'), 'missing');
    expect(host.textContent).toContain('No matching firewalls found.');

    await fill(field('Search Firewalls'), '');
    expect(host.querySelector('[role="checkbox"]')!.getAttribute('aria-checked')).toBe('true');
    await click(button('Next'));
    expect(state.next).toHaveBeenCalled();
    expect((button('Previous') as HTMLButtonElement).disabled).toBe(true);
  });

  it('toggles from the full row and checkbox indicator exactly once', async () => {
    await openPanel();
    let row = host.querySelector('[role="checkbox"]')!;
    await click(row);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(row.getAttribute('aria-checked')).toBe('true');

    await click(row.querySelector('[data-testid="checkbox-indicator"]')!);
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(row.getAttribute('aria-checked')).toBe('false');
  });

  it('supports keyboard selection and disables inactive firewalls', async () => {
    await openPanel();
    let rows = host.querySelectorAll('[role="checkbox"]');
    await act(async () =>
      rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    );
    expect(state.create).toHaveBeenCalledTimes(1);
    await click(rows[1]);
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');
    expect(state.create).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate requests while pending and rolls back failed applies', async () => {
    let resolve: (value: any) => void = () => {};
    state.create.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    await openPanel();
    let row = host.querySelector('[role="checkbox"]')!;
    await click(row);
    await click(row);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(row.getAttribute('aria-busy')).toBe('true');

    await act(async () => resolve([null, { message: 'Failed' }]));
    expect(row.getAttribute('aria-checked')).toBe('false');
    expect(row.getAttribute('aria-busy')).toBe('false');
  });

  it('allows removing an applied inactive firewall and restores it on failure', async () => {
    state.bindings = [{ id: 'old', firewall: { id: 'archived' }, target: { id: 'gateway' } }];
    state.remove.mockResolvedValue([null, { message: 'Failed' }]);
    await openPanel();
    let row = host.querySelectorAll('[role="checkbox"]')[1];
    expect(row.getAttribute('aria-disabled')).toBe('false');
    await click(row);
    expect(state.remove).toHaveBeenCalledWith({
      instanceId: 'instance',
      integrationFirewallAssignmentId: 'old'
    });
    expect(row.getAttribute('aria-checked')).toBe('true');
  });
});

describe('flat network policies', () => {
  it('moves rules through the list controls and disables boundary moves', async () => {
    state.policies = [
      {
        id: 'one',
        name: 'Policy',
        description: null,
        rules: [
          {
            id: 'first',
            effect: 'allow',
            direction: 'egress',
            cidrs: ['0.0.0.0/0'],
            enabled: true,
            priority: 300,
            ports: null,
            description: null
          },
          {
            id: 'second',
            effect: 'deny',
            direction: 'egress',
            cidrs: ['10.0.0.0/8'],
            enabled: false,
            priority: 100,
            ports: [{ from: 443, to: 443 }],
            description: 'Restricted'
          }
        ]
      }
    ];
    state.updatePolicy.mockResolvedValue([{}, null]);
    await render(<NetworkFirewallPage />);
    let up = [...host.querySelectorAll('button[title="Move Rule Up"]')];
    let down = [...host.querySelectorAll('button[title="Move Rule Down"]')];
    expect((up[0] as HTMLButtonElement).disabled).toBe(true);
    expect((down[1] as HTMLButtonElement).disabled).toBe(true);
    await click(up[1]);
    expect(state.updatePolicy).toHaveBeenCalledWith({
      rules: [
        expect.objectContaining({
          effect: 'deny',
          priority: 300,
          enabled: false,
          description: 'Restricted',
          ports: [{ from: 443, to: 443 }]
        }),
        expect.objectContaining({ effect: 'allow', priority: 100 })
      ]
    });
  });

  it('uses one box and renders policies with ordered readable rules and disabled states', async () => {
    state.policies = [
      {
        id: 'one',
        name: 'First Policy',
        description: null,
        rules: [
          {
            id: 'low',
            effect: 'allow',
            direction: 'egress',
            cidrs: ['0.0.0.0/0'],
            enabled: true,
            priority: 100,
            ports: null,
            description: null
          },
          {
            id: 'high',
            effect: 'deny',
            direction: 'ingress',
            cidrs: ['10.0.0.0/8'],
            enabled: false,
            priority: 300,
            ports: null,
            description: null
          }
        ]
      },
      { id: 'two', name: 'Empty Policy', description: null, rules: [] }
    ];
    await render(<NetworkFirewallPage />);
    expect(host.querySelectorAll('h2')).toHaveLength(1);
    expect([...host.querySelectorAll('h3')].map(element => element.textContent)).toEqual([
      'First Policy',
      'Empty Policy'
    ]);
    expect(host.textContent!.indexOf('Incoming traffic')).toBeLessThan(
      host.textContent!.indexOf('Outgoing traffic')
    );
    expect(host.textContent).toContain('Disabled');
    expect(host.textContent).not.toContain('Priority 300');
    expect(host.textContent).toContain('No rules yet.');
    expect(host.querySelector('table')).toBeNull();
  });
});

describe('guided network rules', () => {
  it.each([false, true])('shows Description only when editing: %s', async editing => {
    await render(
      <RuleWizard
        editing={editing}
        loading={false}
        success={false}
        errors={null}
        submitLabel="Save"
        onSubmit={vi.fn()}
        close={state.close}
      />
    );
    await submit();
    expect(host.querySelector('details')).toBeNull();
    expect(host.textContent).not.toContain('Advanced');
    expect(host.textContent).not.toContain('Priority');
    expect(
      [...host.querySelectorAll('label')].some(label =>
        label.textContent?.startsWith('Description')
      )
    ).toBe(editing);
  });

  it('retains values between steps and submits all ranges without enabling a disabled rule', async () => {
    let save = vi.fn().mockResolvedValue(true);
    await render(
      <RuleWizard
        initialValues={ruleValues({
          effect: 'deny',
          direction: 'egress',
          cidrs: ['10.0.0.0/8'],
          enabled: false,
          priority: 200,
          ports: [
            { from: 443, to: 443 },
            { from: 8000, to: 9000 }
          ]
        })}
        loading={false}
        success={false}
        errors={null}
        submitLabel="Save Changes"
        onSubmit={save}
        close={state.close}
      />
    );
    await submit();
    expect(field('Port Numbers or Ranges').value).toBe('443, 8000-9000');
    expect(host.textContent).toContain('Block outgoing traffic to 10.0.0.0/8');
    await click(button('Back'));
    await submit();
    await submit();
    expect(save.mock.calls[0][0].enabled).toBe(false);
    expect(save.mock.calls[0][0].ports).toHaveLength(2);
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('validates connections and remains open when saving fails', async () => {
    let save = vi.fn().mockResolvedValue(false);
    await render(
      <RuleWizard
        loading={false}
        success={false}
        errors={null}
        submitLabel="Add Rule"
        onSubmit={save}
        close={state.close}
      />
    );
    await submit();
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Enter IP addresses');
    await fill(field('IP Addresses or CIDRs'), '203.0.113.5');
    await submit();
    expect(save.mock.calls[0][0].cidrs).toEqual(['203.0.113.5/32']);
    expect(state.close).not.toHaveBeenCalled();
  });

  it('retries attachment without creating another policy', async () => {
    state.createPolicy.mockResolvedValue([{ id: 'new-policy' }, null]);
    state.attachPolicy
      .mockResolvedValueOnce([null, { message: 'Failed' }])
      .mockResolvedValueOnce([{}, null]);
    await render(<NetworkFirewallPage />);
    await click(button('Add Policy'));
    let Modal = state.modal;
    await render(<Modal dialogProps={{}} close={state.close} />);
    await fill(field('Policy Name'), 'Restricted');
    await submit();
    await fill(field('IP Addresses or CIDRs'), '10.0.0.0/8');
    await submit();
    expect(state.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Retry Attachment');
    await submit();
    expect(state.createPolicy).toHaveBeenCalledTimes(1);
    expect(state.attachPolicy).toHaveBeenCalledTimes(2);
    expect(state.close).toHaveBeenCalledOnce();
  });
});
