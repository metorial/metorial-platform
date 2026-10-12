// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderDeploymentPanelFlow, showProviderDeploymentPanelFlow } from './panelFlow';

let state = vi.hoisted(() => ({
  mutate: vi.fn(),
  navigate: vi.fn(),
  showPanel: vi.fn(),
  submit: undefined as
    | undefined
    | ((values: { name: string; description: string }) => Promise<void>),
  loading: false,
  success: false
}));

vi.mock('@metorial/state', () => ({
  useCurrentInstance: () => ({
    data: {
      id: 'instance',
      slug: 'sandbox',
      organization: { slug: 'org' },
      project: { slug: 'project' }
    }
  }),
  useProvider: (_instanceId: string, providerId: string | null) => ({
    data: providerId ? { id: providerId, name: 'Selected Provider' } : null
  }),
  useCreateProviderDeployment: () => ({
    mutate: state.mutate,
    isLoading: state.loading,
    isSuccess: state.success,
    RenderError: () => null
  })
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));

vi.mock('@metorial/data-hooks', () => ({
  renderWithLoader: (loaders: any) => (render: (loaders: any) => React.ReactNode) =>
    loaders.provider.data ? render(loaders) : <span>Loading Provider</span>,
  useForm: (opts: any) => {
    state.submit = opts.onSubmit;
    return {
      handleSubmit: (event: any) => event.preventDefault(),
      getFieldProps: (field: string) => ({ value: opts.initialValues[field] }),
      RenderError: () => null
    };
  }
}));

vi.mock('@metorial/ui', () => ({
  CenteredSpinner: () => <span>Loading</span>,
  Input: ({ label, value }: any) => (
    <label>
      {label}
      <input value={value} readOnly />
    </label>
  ),
  Text: ({ children }: any) => <span>{children}</span>,
  Spacer: () => null,
  Dialog: { Actions: ({ children }: any) => <div>{children}</div> },
  Button: ({ children, type, disabled, onClick }: any) => (
    <button type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}));

vi.mock('../providerCreationPanel', () => ({
  showProviderCreationPanel: state.showPanel,
  ProviderSelectionStep: ({ onSelect }: any) => (
    <button onClick={() => onSelect('provider_123')}>Select Provider</button>
  ),
  ProviderCreationPanelShell: ({
    title,
    description,
    steps,
    currentStep,
    hideStepper
  }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {!hideStepper && <nav>{steps.map((step: any) => step.title).join(' / ')}</nav>}
      {steps[currentStep].render()}
    </div>
  )
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let close = vi.fn();
let setWidth = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  state.submit = undefined;
  state.loading = false;
  state.success = false;
  state.mutate.mockResolvedValue([{ id: 'deployment_123' }, null]);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

let clickButton = async (text: string) => {
  let button = Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === text
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
};

describe('Create Deployment panel', () => {
  it('uses provider selection and details steps with the same widths as Create Config', async () => {
    await act(async () =>
      root.render(
        <ProviderDeploymentPanelFlow
          type="create"
          instanceId="instance"
          close={close}
          setPanelWidth={setWidth}
        />
      )
    );

    expect(container.textContent).toContain('Select Provider / Create Deployment');
    expect(setWidth).toHaveBeenLastCalledWith(1050);
    await clickButton('Select Provider');
    expect(setWidth).toHaveBeenLastCalledWith(660);
    expect(container.querySelector('input')?.value).toBe('Selected Provider');
    await clickButton('Back');
    expect(setWidth).toHaveBeenLastCalledWith(1050);
    expect(container.querySelector('form')).toBeNull();
  });

  it('preserves preset providers, version pins, and creation callbacks', async () => {
    let onCreate = vi.fn();
    await act(async () =>
      root.render(
        <ProviderDeploymentPanelFlow
          type="create"
          instanceId="instance"
          providerId="provider_123"
          providerName="Preset Provider"
          lockedProviderVersionId="version_123"
          lockedProviderVersionLabel="v1"
          onCreate={onCreate}
          close={close}
          setPanelWidth={setWidth}
        />
      )
    );

    expect(container.querySelector('nav')).toBeNull();
    expect(container.textContent).toContain('Pinned to version v1');
    expect(container.querySelector('input')?.value).toBe('Preset Provider');
    await act(async () => state.submit!({ name: ' Deployment ', description: 'Details' }));
    expect(state.mutate).toHaveBeenCalledWith({
      instanceId: 'instance',
      providerId: 'provider_123',
      name: 'Deployment',
      description: 'Details',
      lockedProviderVersionId: 'version_123'
    });
    expect(onCreate).toHaveBeenCalledWith({ id: 'deployment_123' });
    expect(close).toHaveBeenCalledOnce();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('keeps the panel open when creation fails', async () => {
    let onCreate = vi.fn();
    state.mutate.mockResolvedValue([null, new Error('Failed')]);
    await act(async () =>
      root.render(
        <ProviderDeploymentPanelFlow
          type="create"
          providerId="provider_123"
          onCreate={onCreate}
          close={close}
          setPanelWidth={setWidth}
        />
      )
    );
    await act(async () => state.submit!({ name: 'Deployment', description: '' }));

    expect(close).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('passes the existing close callback to the panel host', () => {
    let onClose = vi.fn();
    showProviderDeploymentPanelFlow({ type: 'create', providerId: 'provider_123', onClose });

    expect(state.showPanel).toHaveBeenCalledWith(expect.any(Function), {
      width: 660,
      onClose
    });
  });
});
