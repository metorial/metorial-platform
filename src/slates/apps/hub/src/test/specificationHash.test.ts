import type { SlateAuthenticationMethod, SlatesAction, SlatesTriggerGroup } from '@slates/proto';
import { describe, expect, it } from 'vitest';
import {
  buildDiscoveredSpecificationHashes,
  dedupeDiscoveredItems,
  hashDiscoveredAction,
  hashDiscoveredAuthMethod,
  hashDiscoveredTriggerGroup
} from '../lib/specificationHash';

let baseProviderInfo = {
  protocol: 'slates@2026-01-01',
  provider: {
    type: 'provider',
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Bitbucket provider',
    metadata: {}
  },
  docs: []
};

let baseConfigSchema = {
  schema: {
    type: 'object',
    properties: {
      workspace: {
        type: 'string'
      }
    }
  },
  docs: []
};

let createAuthMethod = (overrides: Record<string, any> = {}): SlateAuthenticationMethod => ({
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
  docs: [],
  ...overrides
});

let createAction = (overrides: Record<string, any> = {}): SlatesAction => ({
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
  isPublic: true,
  inputSchema: {
    type: 'object',
    properties: {}
  },
  outputSchema: {
    type: 'object',
    properties: {}
  },
  capabilities: {},
  docs: [],
  ...overrides
});

let createTriggerGroup = (overrides: Record<string, any> = {}): SlatesTriggerGroup => ({
  id: 'repository_events',
  name: 'Repository events',
  description: 'Repository events',
  metadata: {},
  invocation: {
    type: 'webhook' as const,
    registration: { mode: 'auto' as const }
  },
  ...overrides
});

let build = (
  overrides: {
    authMethods?: SlateAuthenticationMethod[];
    actions?: SlatesAction[];
    triggerGroups?: SlatesTriggerGroup[];
  } = {}
) =>
  buildDiscoveredSpecificationHashes({
    providerInfo: baseProviderInfo,
    configSchema: baseConfigSchema,
    authMethods: overrides.authMethods ?? [createAuthMethod()],
    actions: overrides.actions ?? [createAction()],
    triggerGroups: overrides.triggerGroups ?? [createTriggerGroup()]
  });

describe('specificationHash', () => {
  it('changes specification hash when auth method content changes', async () => {
    let base = await build();

    let changed = await build({
      authMethods: [createAuthMethod({ name: 'Bitbucket Token Auth' })]
    });

    expect(changed.authMethodHashes[0]).not.toBe(base.authMethodHashes[0]);
    expect(changed.specificationHash).not.toBe(base.specificationHash);
  });

  it('changes specification hash when action content changes', async () => {
    let base = await build();

    let changed = await build({
      actions: [createAction({ description: 'List accessible repositories' })]
    });

    expect(changed.actionHashes[0]).not.toBe(base.actionHashes[0]);
    expect(changed.specificationHash).not.toBe(base.specificationHash);
  });

  it('changes specification hash when trigger group content changes', async () => {
    let base = await build();

    let changed = await build({
      triggerGroups: [
        createTriggerGroup({
          invocation: {
            type: 'webhook',
            registration: {
              mode: 'manual',
              userConfigSchema: { type: 'object', properties: {} },
              fullConfigSchema: { type: 'object', properties: {} }
            }
          }
        })
      ]
    });

    expect(changed.triggerGroupHashes[0]).not.toBe(base.triggerGroupHashes[0]);
    expect(changed.specificationHash).not.toBe(base.specificationHash);
  });

  it('keeps specification hash stable when auth, action and trigger group ordering changes', async () => {
    let authA = createAuthMethod({ id: 'oauth', type: 'auth.oauth', scopes: [] });
    let authB = createAuthMethod();
    let actionA = createAction({ id: 'get_repository' });
    let actionB = createAction({ id: 'list_repositories' });
    let groupA = createTriggerGroup({ id: 'repository_events' });
    let groupB = createTriggerGroup({
      id: 'pull_request_events',
      invocation: { type: 'polling', intervalSeconds: 60 * 15 }
    });

    let oneOrder = await build({
      authMethods: [authA, authB],
      actions: [actionA, actionB],
      triggerGroups: [groupA, groupB]
    });

    let otherOrder = await build({
      authMethods: [authB, authA],
      actions: [actionB, actionA],
      triggerGroups: [groupB, groupA]
    });

    expect(otherOrder.specificationHash).toBe(oneOrder.specificationHash);
  });

  it('keeps returned per-item hashes aligned with the original item order', async () => {
    let authA = createAuthMethod({ id: 'oauth', type: 'auth.oauth', scopes: [] });
    let authB = createAuthMethod();
    let actionA = createAction({ id: 'get_repository' });
    let actionB = createAction({ id: 'list_repositories' });
    let groupA = createTriggerGroup({ id: 'repository_events' });
    let groupB = createTriggerGroup({
      id: 'pull_request_events',
      invocation: { type: 'polling', intervalSeconds: 60 * 15 }
    });

    let result = await build({
      authMethods: [authB, authA],
      actions: [actionB, actionA],
      triggerGroups: [groupB, groupA]
    });

    expect(result.authMethodHashes).toEqual([
      await hashDiscoveredAuthMethod(authB),
      await hashDiscoveredAuthMethod(authA)
    ]);
    expect(result.actionHashes).toEqual([
      await hashDiscoveredAction(actionB),
      await hashDiscoveredAction(actionA)
    ]);
    expect(result.triggerGroupHashes).toEqual([
      await hashDiscoveredTriggerGroup(groupB),
      await hashDiscoveredTriggerGroup(groupA)
    ]);
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
