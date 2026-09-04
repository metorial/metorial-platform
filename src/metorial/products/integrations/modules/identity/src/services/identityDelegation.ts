import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type IdentityDelegation,
  IdentityDelegationPermissions,
  type IdentityDelegationStatus,
  type Tenant
} from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveIdentities,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  toProviderEventBase,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  identityDelegationInternalService,
  type CreateDelegationInput
} from './identityDelegationInternal';

let include = {
  identity: true,
  delegationConfig: true,
  attestation: true,
  request: {
    include: {
      requester: {
        include: {
          agent: true
        }
      },
      identity: true
    }
  },
  parties: {
    include: {
      actor: {
        include: {
          agent: true
        }
      }
    }
  },
  credentials: {
    include: {
      credential: true
    }
  }
};
export let delegationInclude = include;

export type ListIdentityDelegationsParams = {
  tenant: Tenant;
  environment: Environment;

  status?: IdentityDelegationStatus[];
  permissions?: IdentityDelegationPermissions[];

  ids?: string[];
  ownerActorIds?: string[];
  delegatorActorIds?: string[];
  delegateeActorIds?: string[];
  identityIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIdentityDelegationByIdParams = {
  tenant: Tenant;
  environment: Environment;
  identityDelegationId: string;
  allowDeleted?: boolean;
};

export type CreateIdentityDelegationParams = {
  tenant: Tenant;
  environment: Environment;
  input: CreateDelegationInput;
};

export type RevokeIdentityDelegationParams = {
  tenant: Tenant;
  environment: Environment;
  delegation: IdentityDelegation;
};

class identityDelegationServiceImpl {
  async listIdentityDelegations(d: MetorialFacing<ListIdentityDelegationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listIdentityDelegationsInternal({ ...rest, tenant, environment });
  }

  async listIdentityDelegationsInternal(d: ListIdentityDelegationsParams) {
    let solution = await getMetorialSolution();
    let scope = { ...d, solution };

    let owners = await resolveIdentityActors(scope, d.ownerActorIds);
    let delegators = await resolveIdentityActors(scope, d.delegatorActorIds);
    let delegatees = await resolveIdentityActors(scope, d.delegateeActorIds);
    let identities = await resolveIdentities(scope, d.identityIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegation.findMany({
            ...opts,

            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                d.status ? { status: { in: d.status } } : undefined!,
                d.permissions ? { permissions: { hasSome: d.permissions } } : undefined!,

                identities ? { identityOid: { in: identities.oids } } : undefined!,

                owners
                  ? {
                      parties: {
                        some: {
                          actorOid: owners.in,
                          roles: { has: 'owner' as const }
                        }
                      }
                    }
                  : undefined!,

                delegators
                  ? {
                      parties: {
                        some: {
                          actorOid: delegators.in,
                          roles: { has: 'delegator' as const }
                        }
                      }
                    }
                  : undefined!,

                delegatees
                  ? {
                      parties: {
                        some: {
                          actorOid: delegatees.in,
                          roles: { has: 'delegatee' as const }
                        }
                      }
                    }
                  : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityDelegationById(d: MetorialFacing<GetIdentityDelegationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getIdentityDelegationByIdInternal({ ...rest, tenant, environment });
  }

  async getIdentityDelegationByIdInternal(d: GetIdentityDelegationByIdParams) {
    let solution = await getMetorialSolution();
    let identityDelegation = await db.identityDelegation.findFirst({
      where: {
        id: d.identityDelegationId,

        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!identityDelegation)
      throw new ServiceError(notFoundError('identity.delegation', d.identityDelegationId));

    return identityDelegation;
  }

  async createIdentityDelegation(d: MetorialFacing<CreateIdentityDelegationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.delegation.created:before', eventBase);

    let identityDelegation = await this.createIdentityDelegationInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.delegation.created:after', {
      ...eventBase,
      identityDelegation
    });

    return identityDelegation;
  }

  async createIdentityDelegationInternal(d: CreateIdentityDelegationParams) {
    return identityDelegationInternalService.createDelegation({
      tenant: d.tenant,
      environment: d.environment,
      _internal: { type: 'create_and_approve' },
      input: d.input
    });
  }

  async revokeIdentityDelegation(d: MetorialFacing<RevokeIdentityDelegationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.delegation.revoked:before', eventBase);

    let identityDelegation = await this.revokeIdentityDelegationInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.delegation.revoked:after', {
      ...eventBase,
      identityDelegation
    });

    return identityDelegation;
  }

  async revokeIdentityDelegationInternal(d: RevokeIdentityDelegationParams) {
    return identityDelegationInternalService.revokeIdentityDelegation({
      tenant: d.tenant,
      environment: d.environment,
      delegation: d.delegation
    });
  }
}

export let identityDelegationService = Service.create(
  'identityDelegation',
  () => new identityDelegationServiceImpl()
).build();
