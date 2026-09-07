import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackInstanceStatus,
  db,
  type Environment,
  type Prisma,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveCallbacks,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  callbackInstanceInclude,
  type CallbackInstanceWithRelations
} from '../lib/callbackIncludes';

export type ListCallbackInstancesParams = {
  ids?: string[];
  callbackIds?: string[];
  integrationInstanceIds?: string[];
  integrationInstanceProviderIds?: string[];
  status?: CallbackInstanceStatus[];
  allowDeleted?: boolean;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetCallbackInstanceByIdParams = {
  callbackInstanceId: string;
  allowDeleted?: boolean;
};

class callbackInstanceServiceImpl {
  async listCallbackInstances(d: MetorialFacing<ListCallbackInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackInstancesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbackInstancesInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackInstancesParams
  ) {
    let solution = await getMetorialSolution();
    let selector = { tenant: d.tenant, environment: d.environment, solution };

    let [callbacks, integrationInstances, integrationInstanceProviders] = await Promise.all([
      resolveCallbacks(selector, d.callbackIds),
      resolveIntegrationInstances(selector, d.integrationInstanceIds),
      resolveIntegrationInstanceProviders(selector, d.integrationInstanceProviderIds)
    ]);

    return Paginator.create<CallbackInstanceWithRelations>(({ prisma }) =>
      prisma(async opts =>
        db.callbackInstance.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).hasParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              callbacks ? { callbackOid: callbacks.in } : undefined!,
              integrationInstances
                ? { integrationInstanceOid: integrationInstances.in }
                : undefined!,
              integrationInstanceProviders
                ? { integrationInstanceProviderOid: integrationInstanceProviders.in }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean) as Prisma.CallbackInstanceWhereInput[]
          },
          include: callbackInstanceInclude
        })
      )
    );
  }

  async getCallbackInstanceById(d: MetorialFacing<GetCallbackInstanceByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackInstanceByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackInstanceByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackInstanceByIdParams
  ) {
    let solution = await getMetorialSolution();

    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        id: d.callbackInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: callbackInstanceInclude
    });
    if (!callbackInstance) {
      throw new ServiceError(notFoundError('callback_instance', d.callbackInstanceId));
    }

    return callbackInstance;
  }
}

export let callbackInstanceService = Service.create(
  'callbackInstance',
  () => new callbackInstanceServiceImpl()
).build();
