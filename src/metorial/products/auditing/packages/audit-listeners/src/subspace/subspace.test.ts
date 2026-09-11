import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent } = vi.hoisted(() => ({ recordEvent: vi.fn() }));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import {
  recordManagedProviderAuthCredentialsCreated,
  recordManagedProviderAuthCredentialsUpdated,
  recordProviderAuthConfigCreated,
  recordProviderAuthConfigUpdated,
  recordProviderAuthCredentialsCreated,
  recordProviderAuthExportCreated
} from './auth';
import { recordCustomProviderUpdated } from './customProvider';
import { recordProviderConfigUpdated, recordProviderDeploymentCreated } from './deployment';
import { recordAgentCreated, recordIdentityDelegationCreated } from './identity';
import { recordIntegrationUpdated } from './integration';
import { recordFirewallUpdated, recordNetworkPolicyRuleChanged } from './network';
import {
  recordEphemeralSessionCreated,
  recordSessionCreated,
  recordSessionProviderCreated
} from './session';

let instance = { oid: 3n, id: 'ins_1' };

let auditScope = {
  organizationOid: 1n,
  instanceOid: instance.oid,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let provider = { id: 'prv_1', name: 'GitHub' };

let authConfig = {
  id: 'pac_1',
  status: 'active',
  type: 'oauth_automated',
  source: 'manual',
  name: 'Production',
  description: null,
  isDefault: true,
  isEphemeral: false,
  scopes: ['repo:read'],
  provider,
  authMethod: { id: 'pam_1', key: 'oauth', name: 'OAuth', type: 'oauth' },
  deployment: { id: 'pdp_1' },
  toolFilter: { type: 'v1.allow_all' },
  archivedAt: null,
  // fields carried on the record but deliberately kept out of the payload
  privateMetadata: { internal: 'note' },
  clientSecret: 'shhh'
} as any;

let event = (extra: Record<string, unknown>) => ({ instance, auditScope, ...extra }) as any;

let callOf = (index = 0) => recordEvent.mock.calls[index]!;

beforeEach(() => recordEvent.mockClear());

describe('subspace audit listeners', () => {
  it('records an auth config with its provider and auth method denormalised', async () => {
    await recordProviderAuthConfigCreated(event({ authConfig }));

    expect(recordEvent).toHaveBeenCalledTimes(1);
    let [scope, resource, action, { payload }] = callOf();
    expect(scope).toBe(auditScope);
    expect(resource).toBe('provider_auth_config');
    expect(action).toBe('create');
    expect(payload.provider).toEqual({ id: 'prv_1', name: 'GitHub' });
    expect(payload.authMethod).toEqual({
      id: 'pam_1',
      key: 'oauth',
      name: 'OAuth',
      type: 'oauth'
    });
    expect(payload.deploymentId).toBe('pdp_1');
  });

  it('never copies credential material or private metadata into the payload', async () => {
    await recordProviderAuthConfigCreated(event({ authConfig }));

    let [, , , { payload }] = callOf();
    expect(payload).not.toHaveProperty('clientSecret');
    expect(payload).not.toHaveProperty('privateMetadata');
    expect(payload).not.toHaveProperty('config');
  });

  it('carries the pre-update record through as the previous payload', async () => {
    await recordProviderAuthConfigUpdated(
      event({
        authConfig: { ...authConfig, name: 'Renamed' },
        previousAuthConfig: authConfig
      })
    );

    let [, , action, { payload, previousPayload }] = callOf();
    expect(action).toBe('update');
    expect(payload.name).toBe('Renamed');
    expect(previousPayload.name).toBe('Production');
  });

  it('records the auth config an export took material from', async () => {
    await recordProviderAuthExportCreated(
      event({
        authExport: {
          id: 'pae_1',
          note: 'rotating',
          ip: '10.0.0.1',
          ua: 'curl',
          authConfig: { id: 'pac_1', provider }
        }
      })
    );

    let [, resource, , { payload }] = callOf();
    expect(resource).toBe('provider_auth_export');
    expect(payload.authConfigId).toBe('pac_1');
    expect(payload.provider).toEqual({ id: 'prv_1', name: 'GitHub' });
  });

  it('skips events that arrive without a scope rather than inventing an actor', async () => {
    await recordProviderAuthConfigCreated({ instance, authConfig } as any);
    await recordProviderAuthCredentialsCreated({
      instance,
      authCredentials: { id: 'pcr_1', provider }
    } as any);
    await recordProviderDeploymentCreated({
      instance,
      deployment: { id: 'pdp_1', provider }
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('records the retention level a session ran at, so later message entries read', async () => {
    await recordSessionCreated(
      event({
        session: {
          id: 'ses_1',
          status: 'active',
          isEphemeral: false,
          name: 'Session',
          description: null,
          dataRetentionLevel: 'none',
          storeToolCallAttachments: false,
          collectErrors: true,
          identity: { id: 'idt_1' },
          identityActor: null,
          providers: [
            {
              id: 'spv_1',
              status: 'active',
              tag: 'github',
              provider,
              deployment: { id: 'pdp_1' },
              config: null,
              authConfig: { id: 'pac_1' }
            }
          ],
          archivedAt: null
        }
      })
    );

    let [, resource, , { payload }] = callOf();
    expect(resource).toBe('session');
    expect(payload.dataRetentionLevel).toBe('none');
    expect(payload.identityId).toBe('idt_1');
    expect(payload.providers).toEqual([
      {
        id: 'spv_1',
        status: 'active',
        tag: 'github',
        provider: { id: 'prv_1', name: 'GitHub' },
        deploymentId: 'pdp_1',
        configId: null,
        authConfigId: 'pac_1'
      }
    ]);
  });

  it('references a session provider by the public session id, not its oid', async () => {
    await recordSessionProviderCreated(
      event({
        sessionProvider: {
          id: 'spv_1',
          status: 'active',
          tag: 'github',
          nameTemplate: null,
          isEphemeral: false,
          sessionOid: 99n,
          session: { id: 'ses_1' },
          provider,
          deployment: null,
          config: null,
          authConfig: null,
          toolFilter: { type: 'v1.allow_all' }
        }
      })
    );

    let [, , , { payload }] = callOf();
    expect(payload.sessionId).toBe('ses_1');
  });

  it('records magic-mcp-backed integrations rather than skipping them', async () => {
    let integration = {
      id: 'int_1',
      status: 'active',
      slug: 'github-abc',
      name: 'GitHub',
      description: null,
      isMagicMcpBacking: true,
      canAttachCustomToolFilters: true,
      canAttachCustomProviderConfig: true,
      canOverrideToolFilters: false,
      currentVersion: { id: 'inv_1' },
      currentVersionIndex: 2,
      archivedAt: null
    };

    await recordIntegrationUpdated(
      event({
        integration: { ...integration, name: 'GitHub Renamed' },
        previousIntegration: integration
      })
    );

    let [, resource, action, { payload, previousPayload }] = callOf();
    expect(resource).toBe('integration');
    expect(action).toBe('update');
    expect(payload.isMagicMcpBacking).toBe(true);
    expect(payload.name).toBe('GitHub Renamed');
    expect(previousPayload.name).toBe('GitHub');
  });

  it('records a firewall policy attach as a diff of its policy list', async () => {
    let network = { id: 'net_1', name: 'Default' };
    let before = {
      id: 'fwl_1',
      status: 'active',
      slug: 'prod',
      name: 'Production',
      description: null,
      network,
      networkPolicyLinks: [],
      archivedAt: null
    };

    await recordFirewallUpdated(
      event({
        firewall: {
          ...before,
          networkPolicyLinks: [
            { position: 0, networkPolicy: { id: 'nwp_1', name: 'Allow GitHub' } }
          ]
        },
        previousFirewall: before
      })
    );

    let [, resource, action, { payload, previousPayload }] = callOf();
    expect(resource).toBe('firewall');
    expect(action).toBe('update');
    expect(previousPayload.networkPolicies).toEqual([]);
    expect(payload.networkPolicies).toEqual([
      { position: 0, networkPolicy: { id: 'nwp_1', name: 'Allow GitHub' } }
    ]);
  });

  it('records a single rule change as a policy update naming that rule', async () => {
    let policy = (rules: unknown[]) => ({
      id: 'nwp_1',
      status: 'active',
      name: 'Allow GitHub',
      description: null,
      currentVersion: { id: 'nwv_2', version: 2, rules },
      currentVersionNumber: 2
    });

    await recordNetworkPolicyRuleChanged(
      event({
        networkPolicy: policy([{ id: 'rul_1', effect: 'allow' }]),
        previousNetworkPolicy: policy([]),
        rule: { id: 'rul_1', effect: 'allow' }
      })
    );

    let [, resource, action, { payload, previousPayload }] = callOf();
    expect(resource).toBe('network_policy');
    expect(action).toBe('update');
    expect(payload.changedRuleId).toBe('rul_1');
    expect(payload.rules).toEqual([{ id: 'rul_1', effect: 'allow' }]);
    expect(previousPayload.rules).toEqual([]);
  });

  it('keeps the custom provider definition payload out of the entry', async () => {
    let customProvider = {
      id: 'cpv_1',
      type: 'custom',
      status: 'active',
      name: 'Internal API',
      description: null,
      provider: { id: 'prv_1', name: 'Internal API' },
      maxVersionIndex: 3,
      payload: { source: 'secret source' }
    };

    await recordCustomProviderUpdated(
      event({
        customProvider: { ...customProvider, name: 'Renamed' },
        previousCustomProvider: customProvider
      })
    );

    let [, , , { payload }] = callOf();
    expect(payload).not.toHaveProperty('payload');
    expect(JSON.stringify(payload)).not.toContain('secret source');
  });

  it('records what a delegation actually granted', async () => {
    await recordIdentityDelegationCreated(
      event({
        identityDelegation: {
          id: 'idg_1',
          status: 'approved',
          delegationLevel: 2,
          permissions: ['tool_call'],
          deniedReason: null,
          note: 'for the nightly job',
          wasCoveredByPreviousDelegationAndAutoApproved: true,
          identity: { id: 'idt_1', name: 'Nightly' }
        }
      })
    );

    let [, resource, , { payload }] = callOf();
    expect(resource).toBe('identity_delegation');
    expect(payload.permissions).toEqual(['tool_call']);
    expect(payload.delegationLevel).toBe(2);
    expect(payload.wasAutoApprovedFromPreviousDelegation).toBe(true);
  });

  it('records an agent', async () => {
    await recordAgentCreated(
      event({
        agent: {
          id: 'agt_1',
          status: 'active',
          type: 'mcp_client',
          name: 'Claude',
          description: null,
          slug: 'claude'
        }
      })
    );

    let [, resource, action, { payload }] = callOf();
    expect(resource).toBe('agent');
    expect(action).toBe('create');
    expect(payload.slug).toBe('claude');
  });

  it('records a session an ephemeral managed session stood up, under the system actor', async () => {
    let systemScope = {
      organizationOid: 1n,
      instanceOid: 3n,
      actor: { type: 'system' as const, id: 'subspace/ephemeralManagedSession' },
      context: { ip: '' }
    };

    await recordEphemeralSessionCreated({
      auditScope: systemScope,
      session: {
        id: 'ses_1',
        status: 'active',
        isEphemeral: true,
        name: 'Managed',
        description: null,
        dataRetentionLevel: 'full',
        storeToolCallAttachments: true,
        collectErrors: true,
        identity: null,
        identityActor: null,
        providers: [],
        archivedAt: null
      }
    } as any);

    // the same resource and payload as a hand-created session -- only the actor differs
    let [scope, resource, action, { payload }] = callOf();
    expect(resource).toBe('session');
    expect(action).toBe('create');
    expect(scope.actor.type).toBe('system');
    expect(scope.actor.id).toBe('subspace/ephemeralManagedSession');
    expect(payload.id).toBe('ses_1');
    expect(payload.isEphemeral).toBe(true);
  });

  it('records managed credentials reconciled into a tenant, organization-scoped', async () => {
    let credentials = {
      id: 'pcr_1',
      status: 'active',
      type: 'oauth',
      origin: 'managed_backing',
      name: 'Managed GitHub',
      description: null,
      isDefault: false,
      isEphemeral: false,
      isAutoRegistration: false,
      scopes: ['repo:read'],
      provider,
      oauthClientSecret: 'do not log me'
    };
    // managed backings carry no instance, so the entry is filed at the organization
    let systemScope = {
      organizationOid: 1n,
      actor: { type: 'system' as const, id: 'subspace/managedProviderAuthCredentials' },
      context: { ip: '' }
    };

    await recordManagedProviderAuthCredentialsCreated({
      auditScope: systemScope,
      authCredentials: credentials
    } as any);

    let [scope, resource, action, { payload }] = callOf();
    expect(resource).toBe('provider_auth_credentials');
    expect(action).toBe('create');
    expect(scope.actor.type).toBe('system');
    expect(scope.instanceOid).toBeUndefined();
    expect(payload.origin).toBe('managed_backing');
    expect(JSON.stringify(payload)).not.toContain('do not log me');

    recordEvent.mockClear();
    await recordManagedProviderAuthCredentialsUpdated({
      auditScope: systemScope,
      authCredentials: { ...credentials, name: 'Renamed' },
      previousAuthCredentials: credentials
    } as any);

    let [, , updateAction, { payload: after, previousPayload: before }] = callOf();
    expect(updateAction).toBe('update');
    expect(after.name).toBe('Renamed');
    expect(before.name).toBe('Managed GitHub');
  });

  it('files an organization-scoped change against the instance it landed in', async () => {
    let { instanceOid, ...organizationScope } = auditScope;
    let config = { id: 'pcf_1', provider, deployment: null };

    await recordProviderConfigUpdated({
      instance,
      auditScope: organizationScope,
      config,
      previousConfig: config
    } as any);

    let [scope] = callOf();
    expect(scope.instanceOid).toBe(instance.oid);
  });
});
