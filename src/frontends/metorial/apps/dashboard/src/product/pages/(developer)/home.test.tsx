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

vi.mock('@metorial/data-list', () => {
  let createDataList = () => {
    let source: any;
    let link: any;
    let builder: any = new Proxy(
      {},
      {
        get: (_target, name: string) => {
          if (name == 'paginated') {
            return (fn: any) => {
              source = fn;
              return builder;
            };
          }

          if (name == 'link') {
            return (fn: any) => {
              link = fn;
              return builder;
            };
          }

          if (name == 'build') {
            return () => (props: any) => {
              let ctx = {
                organization: { slug: 'org' },
                project: { slug: 'project' },
                instance: { slug: 'sandbox' }
              };
              let result = source({ props, ctx, limit: props.listLimit });

              if (result.isLoading) return <span>Loading</span>;
              if (result.error) return <span>Resource Error</span>;

              let items = (result.data?.items ?? []).slice(0, props.listLimit);
              if (items.length == 0) return <span>{props.emptyState}</span>;

              return (
                <ul data-variant={props.listVariant}>
                  {items.map((item: any) => (
                    <li key={item.id}>
                      <a href={link(item, props, ctx)}>{item.name}</a>
                    </li>
                  ))}
                </ul>
              );
            };
          }

          return () => builder;
        }
      }
    );

    return builder;
  };

  return { createDataList, col: new Proxy({}, { get: () => () => ({}) }) };
});

vi.mock('../../scenes/apiKeys', () => ({
  ApiKeysTable: ({ items }: any) => (
    <span>{items.length == 0 ? 'No API keys found.' : `${items.length} keys`}</span>
  )
}));

vi.mock('@metorial/ui-product', () => ({
  Box: ({ title, rightActions, children }: any) => (
    <section>
      <h2>{title}</h2>
      {rightActions}
      {children}
    </section>
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

  it('renders preview lists limited to five rows with product links and no pagination', () => {
    let records = Array.from({ length: 8 }, (_, i) => ({
      id: `id_${i}`,
      name: `Record ${i}`,
      status: 'active',
      createdAt: '2026-10-12'
    }));
    state.deployments = records;
    state.configs = records;
    state.authConfigs = records;
    state.keys = records;
    let html = render();

    expect(html.match(/data-variant="preview"/g)).toHaveLength(3);
    expect(html.match(/<li>/g)).toHaveLength(15);
    expect(html).not.toContain('Record 5');
    expect(html).toContain('8 keys');
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
