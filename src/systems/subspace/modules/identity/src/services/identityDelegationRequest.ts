import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  db,
  type IdentityActor,
  type IdentityDelegation,
  type IdentityDelegationRequest,
  type Environment,
  type IdentityDelegationRequestStatus,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveIdentities,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import { delegationInclude } from './identityDelegation';
import {
  identityDelegationInternalService,
  type CreateDelegationInput
} from './identityDelegationInternal';

let include = {
  delegation: { include: delegationInclude },
  requester: {
    include: {
      agent: true
    }
  },
  identity: true
};

class identityDelegationRequestServiceImpl {
  async listIdentityDelegationRequests(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: IdentityDelegationRequestStatus[];

    ids?: string[];
    actorIds?: string[];
    identityIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegationRequest.findMany({
            ...opts,

            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.status ? { status: { in: d.status } } : undefined!,

                identities ? { identityOid: identities.in } : undefined!,
                actors ? { requesterOid: actors.in } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityDelegationRequestById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityDelegationRequestId: string;
    allowDeleted?: boolean;
  }) {
    let identityDelegationRequest = await db.identityDelegationRequest.findFirst({
      where: {
        id: d.identityDelegationRequestId,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!identityDelegationRequest)
      throw new ServiceError(
        notFoundError('identity.delegation_request', d.identityDelegationRequestId)
      );

    return identityDelegationRequest;
  }

  async createIdentityDelegationRequest(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: Omit<CreateDelegationInput, 'expiresAt' | 'delegatee'> & {
      expiresAt: Date;
      requester: IdentityActor;
    };
  }) {
    let delegation = await identityDelegationInternalService.createDelegation({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      input: {
        ...d.input,
        delegatee: d.input.requester
      },
      _internal: {
        type: 'request',
        requester: d.input.requester,
        expiresAt: d.input.expiresAt
      }
    });

    return {
      ...delegation?.request!,
      delegation: delegation
    };
  }

  async approveIdentityDelegationRequest(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegationRequest: IdentityDelegationRequest & { delegation: IdentityDelegation };
  }) {
    let delegation = await identityDelegationInternalService.alterIdentityDelegationRequest({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      delegationRequest: d.delegationRequest,
      desiredStatus: 'approved'
    });

    return {
      ...delegation?.request!,
      delegation: delegation
    };
  }

  async denyIdentityDelegationRequest(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegationRequest: IdentityDelegationRequest & { delegation: IdentityDelegation };
  }) {
    let delegation = await identityDelegationInternalService.alterIdentityDelegationRequest({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      delegationRequest: d.delegationRequest,
      desiredStatus: 'denied'
    });

    return {
      ...delegation?.request!,
      delegation: delegation
    };
  }
}

export let identityDelegationRequestService = Service.create(
  'identityDelegationRequest',
  () => new identityDelegationRequestServiceImpl()
).build();
