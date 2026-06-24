import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(),
  db: {},
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 1n }),
  Prisma: {
    JsonNull: 'JSON_NULL'
  },
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb({})
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(),
  normalizeStatusForList: vi.fn(),
  resolveIntegrationInstanceProviders: vi.fn(),
  resolveIntegrationInstances: vi.fn(),
  resolveIntegrationProviders: vi.fn(),
  resolveIntegrations: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn(),
  resolveProviderDeployments: vi.fn(),
  resolveProviders: vi.fn(),
  resolveSessionTemplates: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  normalizeToolFilters: (input?: PrismaJson.ToolFilter | null) => {
    if (!input) return { type: 'v1.allow_all' };
    return input;
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../queues/lifecycle/integrationInstanceGroupProvider', () => ({
  enqueueIntegrationInstanceGroupProviderSet: vi.fn(),
  enqueueIntegrationInstanceGroupProvidersSet: vi.fn()
}));

vi.mock('./integrationInstanceGroup', () => ({
  integrationInstanceGroupProviderInclude: {}
}));

import { resolveIntegrationInstanceGroupProviderToolFilterInput } from './integrationInstanceGroupProvider';

let existingFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['old'] }]
};

let replacementFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  ignoreParentFilters: true,
  filters: [{ type: 'tool_keys', keys: ['new'] }]
};

describe('resolveIntegrationInstanceGroupProviderToolFilterInput', () => {
  it('preserves existing filters and override state when input omits toolFilters', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: undefined,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: true
      })
    ).toEqual({
      toolFilter: existingFilter,
      isOverrideToolFilter: true
    });
  });

  it('treats explicit null as clearing the group layer to inherit parent filters', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: null,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: true
      })
    ).toEqual({
      toolFilter: null,
      isOverrideToolFilter: false
    });
  });

  it('uses concrete filters as replacements and strips control fields from storage', () => {
    expect(
      resolveIntegrationInstanceGroupProviderToolFilterInput({
        inputToolFilters: replacementFilter,
        existingToolFilter: existingFilter,
        existingIsOverrideToolFilter: false
      })
    ).toEqual({
      toolFilter: {
        type: 'v1.filter',
        filters: [{ type: 'tool_keys', keys: ['new'] }]
      },
      isOverrideToolFilter: true
    });
  });
});
