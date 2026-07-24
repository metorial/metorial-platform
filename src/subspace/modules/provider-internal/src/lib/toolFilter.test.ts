import { describe, expect, it } from 'vitest';
import { buildIntegrationProviderToolFilterChain, checkToolAccess } from './toolFilter';

let createTool = (key: string) =>
  ({
    id: `ptl_${key}`,
    key: `${key}_67228`,
    callableId: key,
    value: {
      key,
      mcpToolType: {
        type: 'tool.callable'
      }
    }
  }) as any;

let sessionProvider = {
  toolFilter: {
    type: 'v1.allow_all'
  },
  deployment: {
    toolFilter: {
      type: 'v1.allow_all'
    }
  },
  config: {
    toolFilter: {
      type: 'v1.filter',
      filters: [
        {
          type: 'tool_keys',
          keys: ['add', 'divide']
        }
      ]
    }
  },
  authConfig: null
} as any;

describe('checkToolAccess', () => {
  it('matches tool key filters against callable ids for session-tagged tools', () => {
    let addTool = createTool('add');
    let subtractTool = createTool('subtract');

    expect(checkToolAccess(addTool, sessionProvider, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(subtractTool, sessionProvider, 'list')).toEqual({
      allowed: false
    });
  });

  it('matches regex filters against callable ids for session-tagged tools', () => {
    let divideTool = createTool('divide');
    let sessionProviderWithRegex = {
      ...sessionProvider,
      config: {
        toolFilter: {
          type: 'v1.filter',
          filters: [
            {
              type: 'tool_regex',
              pattern: '^div'
            }
          ]
        }
      }
    } as any;

    expect(checkToolAccess(divideTool, sessionProviderWithRegex, 'list')).toEqual({
      allowed: true
    });
  });
});

let toolKeysFilter = (keys: string[]): PrismaJson.ToolFilter => ({
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys }]
});

describe('buildIntegrationProviderToolFilterChain', () => {
  it('preserves integration provider filters when instance provider filters are inherited', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: null,
      integrationInstanceProviderIsOverride: false
    });

    expect(checkToolAccess(addTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: false
    });
  });

  it('does not let non-override allow-all instance filters clear parent filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: { type: 'v1.allow_all' },
      integrationInstanceProviderIsOverride: false
    });

    expect(checkToolAccess(addTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: false
    });
  });

  it('stacks integration provider and instance provider filters as ANDed filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add', 'divide']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['add'])
    });

    expect(Array.isArray(chain)).toBe(true);
    expect(checkToolAccess(addTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: false
    });
  });

  it('lets instance provider overrides reset integration provider filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['divide']),
      integrationInstanceProviderIsOverride: true
    });

    expect(checkToolAccess(addTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: false
    });
    expect(checkToolAccess(divideTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: true
    });
  });

  it('stacks delegated provider filters on top of source filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add', 'divide']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['add', 'divide']),
      integrationInstanceGroupProviderToolFilter: toolKeysFilter(['add'])
    });

    expect(checkToolAccess(addTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: false
    });
  });

  it('lets delegated provider overrides reset integration and instance provider filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceGroupProviderToolFilter: toolKeysFilter(['divide']),
      integrationInstanceGroupProviderIsOverride: true
    });

    expect(checkToolAccess(addTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: false
    });
    expect(checkToolAccess(divideTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: true
    });
  });

  it('ignores instance and delegated provider filters when custom tool filters are disabled', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      canAttachCustomToolFilters: false,
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['divide']),
      integrationInstanceGroupProviderToolFilter: toolKeysFilter(['divide'])
    });

    expect(checkToolAccess(addTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, [chain as PrismaJson.ToolFilter], 'list')).toEqual({
      allowed: false
    });
  });

  it('stacks override filters when tool filter overrides are disabled', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let chain = buildIntegrationProviderToolFilterChain({
      canOverrideToolFilters: false,
      integrationProviderToolFilter: toolKeysFilter(['add']),
      integrationInstanceProviderToolFilter: toolKeysFilter(['add', 'divide']),
      integrationInstanceProviderIsOverride: true
    });

    expect(checkToolAccess(addTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: false
    });
  });

  it('evaluates a session provider carrying a materialized filter chain', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let sessionProviderWithChain = {
      ...sessionProvider,
      toolFilter: buildIntegrationProviderToolFilterChain({
        integrationProviderToolFilter: toolKeysFilter(['add', 'divide']),
        integrationInstanceProviderToolFilter: toolKeysFilter(['add'])
      })
    } as any;

    expect(checkToolAccess(addTool, sessionProviderWithChain, 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(divideTool, sessionProviderWithChain, 'list')).toEqual({
      allowed: false
    });
  });

  it('lets session provider filters reset deployment and config filters', () => {
    let addTool = createTool('add');
    let divideTool = createTool('divide');
    let sessionProviderWithOverride = {
      ...sessionProvider,
      toolFilter: {
        ...toolKeysFilter(['divide']),
        ignoreParentFilters: true
      }
    } as any;

    expect(checkToolAccess(addTool, sessionProviderWithOverride, 'list')).toEqual({
      allowed: false
    });
    expect(checkToolAccess(divideTool, sessionProviderWithOverride, 'list')).toEqual({
      allowed: true
    });
  });
});
