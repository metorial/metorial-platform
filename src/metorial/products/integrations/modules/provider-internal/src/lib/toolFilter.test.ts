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
});

describe('tool_categories filter rule', () => {
  let createCategorizedTool = (
    key: string,
    categories?: string[],
    mcpToolType: Record<string, any> = { type: 'tool.callable' }
  ) =>
    ({
      id: `ptl_${key}`,
      key: `${key}_67228`,
      callableId: key,
      value: {
        key,
        mcpToolType,
        ...(categories ? { categories } : {})
      }
    }) as any;

  let crmTool = createCategorizedTool('crm_get_records', ['crm']);
  let booksTool = createCategorizedTool('books_get_invoice', ['books']);
  let sharedTool = createCategorizedTool('search_contacts', ['crm', 'bigin']);
  let uncategorizedTool = createCategorizedTool('who_am_i');

  let categoriesFilter = (keys: string[]): PrismaJson.ToolFilter => ({
    type: 'v1.filter',
    filters: [{ type: 'tool_categories', keys }]
  });

  it('allows tools in a selected category and denies others', () => {
    let filters = [categoriesFilter(['crm'])];

    expect(checkToolAccess(crmTool, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(booksTool, filters, 'call')).toEqual({ allowed: false });
    expect(checkToolAccess(uncategorizedTool, filters, 'list')).toEqual({ allowed: false });
  });

  it('allows a tool in several categories when any of them is selected', () => {
    expect(checkToolAccess(sharedTool, [categoriesFilter(['bigin'])], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(sharedTool, [categoriesFilter(['crm'])], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(sharedTool, [categoriesFilter(['books'])], 'list')).toEqual({
      allowed: false
    });
  });

  it('ORs category rules with tool_keys rules inside one filter', () => {
    let filters: PrismaJson.ToolFilter[] = [
      {
        type: 'v1.filter',
        filters: [
          { type: 'tool_categories', keys: ['crm'] },
          { type: 'tool_keys', keys: ['books_get_invoice'] }
        ]
      }
    ];
    let otherBooksTool = createCategorizedTool('books_list_invoices', ['books']);

    expect(checkToolAccess(crmTool, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(booksTool, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(otherBooksTool, filters, 'list')).toEqual({ allowed: false });
  });

  it('ANDs category rules across filter layers', () => {
    let filters = [categoriesFilter(['crm', 'bigin']), toolKeysFilter(['search_contacts'])];

    expect(checkToolAccess(sharedTool, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(crmTool, filters, 'list')).toEqual({ allowed: false });

    let chain = buildIntegrationProviderToolFilterChain({
      integrationProviderToolFilter: categoriesFilter(['crm']),
      integrationInstanceProviderToolFilter: categoriesFilter(['bigin'])
    });

    expect(checkToolAccess(sharedTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(crmTool, chain as PrismaJson.ToolFilter[], 'list')).toEqual({
      allowed: false
    });
  });

  it('allows nothing for unknown category keys', () => {
    let filters = [categoriesFilter(['does_not_exist'])];

    expect(checkToolAccess(crmTool, filters, 'list')).toEqual({ allowed: false });
    expect(checkToolAccess(uncategorizedTool, filters, 'list')).toEqual({ allowed: false });
  });

  it('allows nothing for an empty key list', () => {
    expect(checkToolAccess(crmTool, [categoriesFilter([])], 'list')).toEqual({
      allowed: false
    });
  });

  it('matches nothing for tools of old specifications without categories', () => {
    let oldTool = createTool('add');

    expect(checkToolAccess(oldTool, [categoriesFilter(['crm'])], 'list')).toEqual({
      allowed: false
    });
    expect(checkToolAccess(oldTool, sessionProvider, 'list')).toEqual({ allowed: true });
    expect(
      checkToolAccess(
        oldTool,
        [
          {
            type: 'v1.filter',
            filters: [
              { type: 'tool_categories', keys: ['crm'] },
              { type: 'tool_keys', keys: ['add'] }
            ]
          }
        ],
        'list'
      )
    ).toEqual({ allowed: true });
  });

  it('applies to mcp tools', () => {
    let mcpTool = createCategorizedTool('remote_tool', ['crm'], {
      type: 'mcp.tool',
      key: 'remote_tool'
    });

    expect(checkToolAccess(mcpTool, [categoriesFilter(['crm'])], 'list')).toEqual({
      allowed: true
    });
    expect(checkToolAccess(mcpTool, [categoriesFilter(['books'])], 'list')).toEqual({
      allowed: false
    });
  });

  it('is ignored by prompts and resources', () => {
    let prompt = createCategorizedTool('summarize', undefined, {
      type: 'mcp.prompt',
      key: 'summarize'
    });
    let resourceTemplate = createCategorizedTool('file', undefined, {
      type: 'mcp.resource_template',
      uriTemplate: 'file:///{path}'
    });
    let resourcesList = createCategorizedTool('resources_list', undefined, {
      type: 'mcp.resources_list'
    });
    let filters = [categoriesFilter(['crm'])];

    expect(checkToolAccess(prompt, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(resourceTemplate, filters, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(resourcesList, filters, 'list')).toEqual({ allowed: true });
  });

  it('denies every tool with tool_keys: []', () => {
    let filters = [toolKeysFilter([])];

    expect(checkToolAccess(crmTool, filters, 'list')).toEqual({ allowed: false });
    expect(checkToolAccess(uncategorizedTool, filters, 'list')).toEqual({ allowed: false });
  });
});
