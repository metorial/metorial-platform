import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackStatus,
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
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { type AuditSubspaceCallback, Fabric } from '@metorial/fabric';
import { callbackInclude, type CallbackWithRelations } from '../lib/callbackIncludes';

export type ListCallbacksParams = {
  ids?: string[];
  integrationIds?: string[];
  integrationProviderIds?: string[];
  providerIds?: string[];
  status?: CallbackStatus[];
  allowDeleted?: boolean;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetCallbackByIdParams = {
  callbackId: string;
  allowDeleted?: boolean;
};

export type UpdateCallbackParams = {
  callback: CallbackWithRelations;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
  };
};

export let toAuditCallback = (callback: CallbackWithRelations): AuditSubspaceCallback => ({
  id: callback.id,
  status: callback.status,
  name: callback.name,
  description: callback.description,
  integration: { id: callback.integration.id },
  integrationProvider: { id: callback.integrationProvider.id },
  provider: { id: callback.provider.id, name: callback.provider.name }
});

class callbackServiceImpl {
  async listCallbacks(d: MetorialFacing<ListCallbacksParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbacksInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbacksInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbacksParams
  ) {
    let solution = await getMetorialSolution();
    let selector = { tenant: d.tenant, environment: d.environment, solution };

    let [integrations, integrationProviders, providers] = await Promise.all([
      resolveIntegrations(selector, d.integrationIds),
      resolveIntegrationProviders(selector, d.integrationProviderIds),
      resolveProviders(selector, d.providerIds)
    ]);

    return Paginator.create<CallbackWithRelations>(({ prisma }) =>
      prisma(async opts =>
        db.callback.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              integrations ? { integrationOid: integrations.in } : undefined!,
              integrationProviders
                ? { integrationProviderOid: integrationProviders.in }
                : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean) as Prisma.CallbackWhereInput[]
          },
          include: callbackInclude
        })
      )
    );
  }

  async getCallbackById(d: MetorialFacing<GetCallbackByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackByIdParams
  ) {
    let solution = await getMetorialSolution();

    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: callbackInclude
    });
    if (!callback) throw new ServiceError(notFoundError('callback', d.callbackId));

    return callback;
  }

  async updateCallback(d: MetorialFacing<UpdateCallbackParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback.updated:before', eventBase);

    let callback = await this.updateCallbackInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback.updated:after', {
      ...eventBase,
      callback: toAuditCallback(callback),
      previousCallback: toAuditCallback(d.callback)
    });

    return callback;
  }

  async updateCallbackInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateCallbackParams
  ) {
    if (d.callback.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          code: 'callback_not_active',
          message: 'Only an active callback can be updated.'
        })
      );
    }

    if (d.input.name !== undefined || d.input.description !== undefined) {
      let providerVariant = await db.providerVariant.findUniqueOrThrow({
        where: { oid: d.callback.providerVariantOid }
      });

      let backend = await getBackend({ entity: providerVariant });
      await backend.callbacks?.updateCallback({
        tenant: d.tenant,
        callback: d.callback,
        input: { name: d.input.name, description: d.input.description }
      });
    }

    return await db.callback.update({
      where: { oid: d.callback.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include: callbackInclude
    });
  }
}

export let callbackService = Service.create(
  'callback',
  () => new callbackServiceImpl()
).build();
