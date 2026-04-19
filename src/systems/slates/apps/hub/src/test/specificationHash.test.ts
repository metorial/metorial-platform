import { describe, expect, it } from 'vitest';
import {
  buildDiscoveredSpecificationHashes,
  dedupeDiscoveredItems
} from '../lib/specificationHash';

let baseProviderInfo = {
  protocol: 'slates@2026-01-01',
  provider: {
    type: 'provider',
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Bitbucket provider',
    metadata: {}
  }
};

let baseConfigSchema = {
  type: 'object',
  properties: {
    workspace: {
      type: 'string'
    }
  }
};

let createAuthMethod = (overrides: Record<string, any> = {}) => ({
  id: 'token',
  name: 'Token Auth',
  type: 'auth.token' as const,
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string'
      }
    }
  },
  outputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string'
      }
    }
  },
  capabilities: {
    getProfile: { enabled: true }
  },
  ...overrides
});

let createAction = (overrides: Record<string, any> = {}) => ({
  id: 'list_repositories',
  name: 'List repositories',
  description: 'List repositories',
  instructions: ['List repositories'],
  constraints: [],
  tags: {
    readOnly: true
  },
  metadata: {},
  type: 'action.tool' as const,
  inputSchema: {
    type: 'object',
    properties: {}
  },
  outputSchema: {
    type: 'object',
    properties: {}
  },
  capabilities: {},
  ...overrides
});

describe('specificationHash', () => {
  it('changes specification hash when auth method content changes', async () => {
    let base = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [createAuthMethod()],
      actions: [createAction()]
    });

    let changed = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [createAuthMethod({ name: 'Bitbucket Token Auth' })],
      actions: [createAction()]
    });

    expect(changed.authMethodHashes[0]).not.toBe(base.authMethodHashes[0]);
    expect(changed.specificationHash).not.toBe(base.specificationHash);
  });

  it('changes specification hash when action content changes', async () => {
    let base = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [createAuthMethod()],
      actions: [createAction()]
    });

    let changed = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [createAuthMethod()],
      actions: [createAction({ description: 'List accessible repositories' })]
    });

    expect(changed.actionHashes[0]).not.toBe(base.actionHashes[0]);
    expect(changed.specificationHash).not.toBe(base.specificationHash);
  });

  it('keeps specification hash stable when auth and action ordering changes', async () => {
    let authA = createAuthMethod({ id: 'oauth', type: 'auth.oauth', scopes: [] });
    let authB = createAuthMethod();
    let actionA = createAction({ id: 'get_repository' });
    let actionB = createAction({ id: 'list_repositories' });

    let oneOrder = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [authA, authB],
      actions: [actionA, actionB]
    });

    let otherOrder = await buildDiscoveredSpecificationHashes({
      providerInfo: baseProviderInfo,
      configSchema: baseConfigSchema,
      authMethods: [authB, authA],
      actions: [actionB, actionA]
    });

    expect(otherOrder.specificationHash).toBe(oneOrder.specificationHash);
  });

  it('deduplicates discovered items by logical key', () => {
    let items = [
      { id: 'token', name: 'Token Auth' },
      { id: 'token', name: 'Token Auth Duplicate' },
      { id: 'oauth', name: 'OAuth' }
    ];

    let deduped = dedupeDiscoveredItems(items, {
      entity: 'auth_methods',
      slateId: 'slate_123',
      versionId: 'version_123'
    });

    expect(deduped).toEqual([
      { id: 'token', name: 'Token Auth' },
      { id: 'oauth', name: 'OAuth' }
    ]);
  });
});
