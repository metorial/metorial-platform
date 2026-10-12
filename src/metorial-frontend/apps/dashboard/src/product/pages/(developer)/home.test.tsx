import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setNexusManifest } from '@metorial/frontend-config';
import { DeveloperHomePage } from './home';

let state = vi.hoisted(() => ({
  keys: [] as any[],
  deployments: [] as any[],
  configs: [] as any[],
  authConfigs: [] as any[],
  error: null as string | null,
  loading: false,
  reveal: vi.fn(),
  revealHook: vi.fn(),
  create: vi.fn(),
  autoInit: vi.fn(() => {
    throw new Error('Developer Home must not initialize API keys');
  }),
  deploymentQuery: vi.fn(),
  configQuery: vi.fn(),
  authConfigQuery: vi.fn()
}));

vi.mock('../../scenes/apiKeys/useApiKeysWithAutoInit', () => ({
  useApiKeysWithAutoInit: state.autoInit
}));

vi.mock('@metorial/state', () => ({
  useCurrentOrganization: () => ({ data: { id: 'org', slug: 'org' } }),
  useCurrentProject: () => ({ data: { id: 'project', slug: 'project' } }),
  useCurrentInstance: () => ({
    data: { id: 'instance', slug: 'sandbox', type: 'development' }
  }),
  useApiKeys: () => ({
    data: state.keys,
    isLoading: state.loading,
    error: state.error,
    createMutator: state.create
  }),
  useRevealableApiKey: (props: unknown) => {
    state.revealHook(props);
    return { value: undefined, isLoading: false, reveal: state.reveal };
  },
  useProviderDeployments: (instanceId: string, query: unknown) => {
    state.deploymentQuery(instanceId, query);
    return {
      data: { items: state.deployments },
      isLoading: state.loading,
      error: state.error
    };
  },
  useProviderConfigs: (instanceId: string, query: unknown) => {
    state.configQuery(instanceId, query);
    return { data: { items: state.configs }, isLoading: state.loading, error: state.error };
  },
  useProviderAuthConfigs: (instanceId: string, query: unknown) => {
    state.authConfigQuery(instanceId, query);
    return {
      data: { items: state.authConfigs },
      isLoading: state.loading,
      error: state.error
    };
  }
}));

vi.mock('@metorial/data-hooks', () => ({
  renderWithLoader:
    (loaders: Record<string, any>) => (render: (loaders: any) => React.ReactNode) => {
      if (Object.values(loaders).some(loader => loader?.isLoading))
        return <span>Loading</span>;
      if (Object.values(loaders).some(loader => loader?.error))
        return <span>Resource Error</span>;
      return render(loaders);
    },
  useForm: vi.fn()
}));

vi.mock('@metorial/layout', () => ({
  ContentLayout: ({ children }: any) => <main>{children}</main>,
  PageHeader: ({ title }: any) => <h1>{title}</h1>
}));

vi.mock('@metorial/ui', () => ({
  theme: { colors: { gray300: '#ddd', gray600: '#666', gray700: '#777' } },
  Badge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
  Flex: ({ children }: any) => <span>{children}</span>,
  RenderDate: ({ date }: any) => <span>{String(date)}</span>,
  Tooltip: ({ children }: any) => <span>{children}</span>,
  useCopy: () => ({ copy: vi.fn(), copied: false })
}));

vi.mock('@metorial/table', () => ({
  Table: class {
    state() {
      return this;
    }
    columns() {
      return this;
    }
    search() {
      return this;
    }
    build() {
      return () => null;
    }
  }
}));

vi.mock('@metorial/ui-product', () => ({
  Box: ({ title, rightActions, children }: any) => (
    <section>
      <h2>{title}</h2>
      {rightActions}
      {children}
    </section>
  ),
  Table: ({ headers, data }: any) => (
    <table>
      <thead>
        <tr>
          {headers.map((header: string, i: number) => (
            <th key={i}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, i: number) => (
          <tr key={i}>
            {(Array.isArray(row) ? row : row.data).map((cell: any, j: number) => (
              <td key={j}>{row.href ? <a href={row.href}>{cell}</a> : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}));

let render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <DeveloperHomePage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.keys = [];
  state.deployments = [];
  state.configs = [];
  state.authConfigs = [];
  state.loading = false;
  state.error = null;
  setNexusManifest({ slices: [{ id: 'product', access: { owner: 'self', pathname: '/i' } }] });
});

describe('Developer Home', () => {
  it('shows four empty resource boxes with product View More destinations', () => {
    let html = render();

    expect(html.match(/<section>/g)).toHaveLength(4);
    expect(html.match(/View More/g)).toHaveLength(4);
    expect(html).toContain('No API keys found.');
    expect(html).toContain('No deployments found.');
    expect(html).toContain('No configs found.');
    expect(html).toContain('No auth configs found.');
    for (let path of [
      'developer/api-keys',
      'configurations',
      'configurations/configs',
      'configurations/auth-configs'
    ]) {
      expect(html).toContain(`href="/i/sandbox/${path}"`);
    }
    expect(state.create).not.toHaveBeenCalled();
    expect(state.autoInit).not.toHaveBeenCalled();
    expect(state.reveal).not.toHaveBeenCalled();
  });

  it('shows at most five rows with shared secret previews, no statuses, and no pagination', () => {
    let records = Array.from({ length: 8 }, (_, i) => ({
      id: `id_${i}`,
      name: `Record ${i}`,
      status: 'active',
      createdAt: '2026-10-12'
    }));
    state.deployments = records;
    state.configs = records;
    state.authConfigs = records;
    state.keys = records.map(item => ({
      ...item,
      type: 'instance_access_token_secret',
      secretRedacted: 'metorial_...redacted',
      secretRedactedLong: 'metorial_...redacted-long',
      revealInfo: item.id === 'id_0' ? { forever: true } : null,
      expiresAt: null,
      lastUsedAt: null
    }));
    let html = render();

    expect(html.match(/<tbody><tr>/g)).toHaveLength(4);
    expect(html.match(/<tr>/g)).toHaveLength(24);
    expect(html).not.toContain('Record 5');
    expect(html).toContain('<th>Secret</th>');
    expect(html).toContain('metorial_...redacted');
    expect(html).toContain('Reveal Secret');
    expect(html).toContain('metorial_...redacted-long');
    expect(html).not.toContain('<th>Status</th>');
    expect(state.revealHook).toHaveBeenCalledTimes(5);
    expect(html).not.toContain('Previous');
    expect(html).not.toContain('Next');
    expect(html).toContain('href="/i/sandbox/configurations/id_0"');
    expect(html).toContain('href="/i/sandbox/configurations/config/id_0"');
    expect(html).toContain('href="/i/sandbox/configurations/auth-config/id_0"');
    for (let query of [state.deploymentQuery, state.configQuery, state.authConfigQuery]) {
      expect(query).toHaveBeenCalledWith('instance', { limit: 5, order: 'desc' });
    }
    expect(state.create).not.toHaveBeenCalled();
    expect(state.autoInit).not.toHaveBeenCalled();
    expect(state.reveal).not.toHaveBeenCalled();
  });

  it('retains resource navigation while previews load or fail', () => {
    state.loading = true;
    expect(render().match(/Loading/g)).toHaveLength(4);
    state.loading = false;
    state.error = 'Failed';
    let html = render();

    expect(html.match(/Resource Error/g)).toHaveLength(4);
    expect(html.match(/View More/g)).toHaveLength(4);
  });
});
