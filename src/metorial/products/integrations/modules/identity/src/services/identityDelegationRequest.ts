import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type IdentityActor,
  type IdentityDelegation,
  type IdentityDelegationRequest,
  type IdentityDelegationRequestStatus,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveIdentities,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
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

export type ListIdentityDelegationRequestsParams = {
  tenant: Tenant;
  environment: Environment;

  status?: IdentityDelegationRequestStatus[];

  ids?: string[];
  actorIds?: string[];
  identityIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIdentityDelegationRequestByIdParams = {
  tenant: Tenant;
  environment: Environment;
  identityDelegationRequestId: string;
  allowDeleted?: boolean;
};

export type CreateIdentityDelegationRequestParams = {
  tenant: Tenant;
  environment: Environment;
  input: Omit<CreateDelegationInput, 'expiresAt' | 'delegatee'> & {
    expiresAt: Date;
    requester: IdentityActor;
  };
};

export type ApproveIdentityDelegationRequestParams = {
  tenant: Tenant;
  environment: Environment;
  delegationRequest: IdentityDelegationRequest & { delegation: IdentityDelegation };
};

export type DenyIdentityDelegationRequestParams = ApproveIdentityDelegationRequestParams;

class identityDelegationRequestServiceImpl {
  async listIdentityDelegationRequests(d: MetorialFacing<ListIdentityDelegationRequestsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listIdentityDelegationRequestsInternal({ ...rest, tenant, environment });
  }

  async listIdentityDelegationRequestsInternal(d: ListIdentityDelegationRequestsParams) {
    let solution = await getMetorialSolution();
    let scope = { ...d, solution };

    let actors = await resolveIdentityActors(scope, d.actorIds);
    let identities = await resolveIdentities(scope, d.identityIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegationRequest.findMany({
            ...opts,

            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
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

  async getIdentityDelegationRequestById(
    d: MetorialFacing<GetIdentityDelegationRequestByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getIdentityDelegationRequestByIdInternal({ ...rest, tenant, environment });
  }

  async getIdentityDelegationRequestByIdInternal(d: GetIdentityDelegationRequestByIdParams) {
    let solution = await getMetorialSolution();
    let identityDelegationRequest = await db.identityDelegationRequest.findFirst({
      where: {
        id: d.identityDelegationRequestId,

        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
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

  async createIdentityDelegationRequest(
    d: MetorialFacing<CreateIdentityDelegationRequestParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.createIdentityDelegationRequestInternal({ ...rest, tenant, environment });
  }

  async createIdentityDelegationRequestInternal(d: CreateIdentityDelegationRequestParams) {
    let delegation = await identityDelegationInternalService.createDelegation({
      tenant: d.tenant,
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

  async approveIdentityDelegationRequest(
    d: MetorialFacing<ApproveIdentityDelegationRequestParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.approveIdentityDelegationRequestInternal({ ...rest, tenant, environment });
  }

  async approveIdentityDelegationRequestInternal(d: ApproveIdentityDelegationRequestParams) {
    let delegation = await identityDelegationInternalService.alterIdentityDelegationRequest({
      tenant: d.tenant,
      environment: d.environment,
      delegationRequest: d.delegationRequest,
      desiredStatus: 'approved'
    });

    return {
      ...delegation?.request!,
      delegation: delegation
    };
  }

  async denyIdentityDelegationRequest(d: MetorialFacing<DenyIdentityDelegationRequestParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.denyIdentityDelegationRequestInternal({ ...rest, tenant, environment });
  }

  async denyIdentityDelegationRequestInternal(d: DenyIdentityDelegationRequestParams) {
    let delegation = await identityDelegationInternalService.alterIdentityDelegationRequest({
      tenant: d.tenant,
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
