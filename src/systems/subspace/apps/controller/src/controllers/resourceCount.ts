import { v } from '@lowerdeck/validation';
import { db } from '@metorial-subspace/db';
import { app } from './_app';
import { tenantApp } from './tenant';

export let resourceCountResources = [
  'provider_deployments',
  'provider_configs',
  'provider_config_vaults',
  'provider_auth_configs',
  'provider_auth_credentials',
  'session_templates',
  'networks',
  'firewalls',
  'enclaves',
  'accounts',
  'agents',
  'identity_actors',
  'identities',
  'identity_delegations',
  'identity_delegation_configs'
] as const;

export type ResourceCountResource = (typeof resourceCountResources)[number];

let resourceValidator = v.enumOf([...resourceCountResources]);

let normalizeResources = (resource: ResourceCountResource | ResourceCountResource[]) => {
  let resources = Array.isArray(resource) ? resource : [resource];
  return [...new Set(resources)];
};

export let resourceCountController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        resource: v.union([resourceValidator, v.array(resourceValidator)])
      })
    )
    .do(async ctx => {
      let resources = normalizeResources(ctx.input.resource);
      let scopedWhere = {
        tenantOid: ctx.tenant.oid,
        solutionOid: ctx.solution.oid,
        environmentOid: ctx.environment.oid
      };
      let networkScopedWhere = {
        tenantOid: ctx.tenant.oid,
        environmentOid: ctx.environment.oid
      };

      let counters = {
        provider_deployments: () =>
          db.providerDeployment.count({
            where: { ...scopedWhere, status: 'active' }
          }),
        provider_configs: () =>
          db.providerConfig.count({
            where: { ...scopedWhere, status: 'active', isForVault: false }
          }),
        provider_config_vaults: () =>
          db.providerConfigVault.count({
            where: { ...scopedWhere, status: 'active' }
          }),
        provider_auth_configs: () =>
          db.providerAuthConfig.count({
            where: { ...scopedWhere, status: 'active', isParentDeleted: false }
          }),
        provider_auth_credentials: () =>
          db.providerAuthCredentials.count({
            where: { ...scopedWhere, status: 'active', isEphemeral: false }
          }),
        session_templates: () =>
          db.sessionTemplate.count({
            where: { ...scopedWhere, status: 'active' }
          }),
        networks: () =>
          db.network.count({
            where: networkScopedWhere
          }),
        firewalls: () =>
          db.firewall.count({
            where: { ...networkScopedWhere, status: 'active' }
          }),
        enclaves: () =>
          db.enclave.count({
            where: networkScopedWhere
          }),
        accounts: () =>
          db.identityActor.count({
            where: {
              ...scopedWhere,
              type: 'person',
              status: 'active',
              isParentDeleted: false
            }
          }),
        agents: () =>
          db.agent.count({
            where: { ...scopedWhere, status: 'active', isParentDeleted: false }
          }),
        identity_actors: () =>
          db.identityActor.count({
            where: { ...scopedWhere, status: 'active', isParentDeleted: false }
          }),
        identities: () =>
          db.identity.count({
            where: { ...scopedWhere, status: 'active', isParentDeleted: false }
          }),
        identity_delegations: () =>
          db.identityDelegation.count({
            where: { ...scopedWhere, status: 'active' }
          }),
        identity_delegation_configs: () =>
          db.identityDelegationConfig.count({
            where: { ...scopedWhere, status: 'active', isParentDeleted: false }
          })
      } satisfies Record<ResourceCountResource, () => Promise<number>>;

      let counts = await Promise.all(
        resources.map(async resource => ({
          resource,
          count: await counters[resource]()
        }))
      );

      return { resources: counts };
    })
});
