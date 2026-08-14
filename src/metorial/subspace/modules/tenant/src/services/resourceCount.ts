import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '../lib/metorialFacing';

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

type GetResourceCountsParams = {
  resource: ResourceCountResource | ResourceCountResource[];
};

let normalizeResources = (resource: ResourceCountResource | ResourceCountResource[]) => {
  let resources = Array.isArray(resource) ? resource : [resource];
  return [...new Set(resources)];
};

class resourceCountServiceImpl {
  async getResourceCounts(d: MetorialFacing<GetResourceCountsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getResourceCountsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getResourceCountsInternal(
    d: { tenant: Tenant; environment: Environment } & GetResourceCountsParams
  ) {
    let resources = normalizeResources(d.resource);
    let solution = await getMetorialSolution();

    let scopedWhere = {
      tenantOid: d.tenant.oid,
      solutionOid: solution.oid,
      environmentOid: d.environment.oid
    };
    let networkScopedWhere = {
      tenantOid: d.tenant.oid,
      environmentOid: d.environment.oid
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
  }
}

export let resourceCountService = Service.create(
  'resourceCountService',
  () => new resourceCountServiceImpl()
).build();
