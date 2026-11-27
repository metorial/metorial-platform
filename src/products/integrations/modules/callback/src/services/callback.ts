import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { v } from '@lowerdeck/validation';
import {
  type CallbackInstance,
  type CallbackStatus,
  db,
  type Environment,
  Prisma,
  type Provider,
  type ProviderAuthConfig,
  type Tenant
} from '@metorial-subspace/db';
import {
  buildSearchFilter,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  getMetorialSolution,
  getOwnershipAccessor,
  type MetorialFacing,
  ownedResourceWhere,
  type OwnershipAccessor,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import type {
  TriggerSelectionOptionsListRes,
  TriggerSelectionOptionsSource
} from '@metorial-subspace/provider-utils';
import { type AuditSubspaceCallback, Fabric } from '@metorial/fabric';
import { callbackInclude, type CallbackWithRelations } from '../lib/callbackIncludes';
import { callbacksNotSupported, getCallbacksBackend } from '../lib/callbacksBackend';
import {
  changedTriggerGroupKeys,
  sameTriggerGroupSelections
} from '../lib/callbackInstanceGeneration';
import { assertSelectionsMatchTriggerGroups } from '../lib/selectionSchema';
import { parseTriggerGroupSelections } from '../lib/triggerGroupSelections';
import { callbackInstanceReconcileManyQueue } from '../queues/reconcile/callbackInstance';
import { indexCallbackQueue } from '../queues/search/callback';

let LINKABLE_AUTH_CONFIGS_MAX = 100;

export type ListCallbacksParams = {
  ids?: string[];
  integrationIds?: string[];
  integrationProviderIds?: string[];
  providerIds?: string[];
  search?: string;
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
    triggerGroupSelections?: PrismaJson.TriggerGroupSelections | null;
  };
};

export type ListTriggerSelectionOptionsParams = {
  callback: CallbackWithRelations;
  input: {
    triggerGroupKey: string;
    field: string;
    callbackInstanceId?: string;
    search?: string;
  };
};

export type TriggerSelectionOption = TriggerSelectionOptionsListRes['options'][number];

let pageTokenValidator = v.object({
  source: v.enumOf(['own', 'linked']),
  value: v.any()
});

let invalidPageTokenError = () =>
  new ServiceError(badRequestError({ message: 'Invalid page token.' }));

let decodePageToken = (pageToken?: string) => {
  if (!pageToken) return undefined;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(pageToken, 'base64url').toString('utf8'));
  } catch {
    throw invalidPageTokenError();
  }

  let result = pageTokenValidator.validate(decoded);
  if (!result.success) throw invalidPageTokenError();

  return { source: result.value.source, value: result.value.value };
};

let encodePageToken = (d: { source: TriggerSelectionOptionsSource; value: unknown }) =>
  d.value === null || d.value === undefined || d.value === ''
    ? undefined
    : Buffer.from(JSON.stringify(d)).toString('base64url');

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

    let search = await buildSearchFilter<Prisma.CallbackWhereInput>({
      search: d.search,
      findIds: async query => {
        let records = await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.callback.id,
          query
        });

        return records.map(r => r.documentId);
      }
    });

    return Paginator.create<CallbackWithRelations>(({ prisma }) =>
      prisma(async opts =>
        db.callback.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            ownership: 'user',
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              integrations ? { integrationOid: integrations.in } : undefined!,
              integrationProviders
                ? { integrationProviderOid: integrationProviders.in }
                : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              search ?? undefined!,
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
        ownership: 'user',
        ...normalizeStatusForGet(d).noParent
      },
      include: callbackInclude
    });
    if (!callback) throw new ServiceError(notFoundError('callback', d.callbackId));

    return callback;
  }

  async listTriggerSelectionOptions(d: MetorialFacing<ListTriggerSelectionOptionsParams>) {
    let scope = await resolveMetorialFacing(d);
    let accessor = await getOwnershipAccessor({
      tenant: scope.tenant,
      organizationActor: d.organizationActor
    });

    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        callbackOid: d.callback.oid,
        tenantOid: scope.tenant.oid,
        id: d.input.callbackInstanceId,
        status: 'active',
        generationStatus: 'primary',
        isParentDeleted: false,
        integrationInstance: ownedResourceWhere(accessor, {
          ownership: 'usable',
          fallback: { field: 'identityActorOid', relation: 'identityActor' }
        }),
        OR: [
          { providerAuthConfigVersionOid: null },
          {
            providerAuthConfigVersion: {
              authConfig: ownedResourceWhere(accessor, { ownership: 'usable' })
            }
          }
        ]
      },
      include: { providerAuthConfigVersion: { include: { authConfig: true } } },
      orderBy: { createdAt: 'desc' }
    });
    if (!callbackInstance && d.input.callbackInstanceId) {
      throw new ServiceError(notFoundError('callback_instance', d.input.callbackInstanceId));
    }
    if (!callbackInstance) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_not_connected',
          message: 'Connect an account to this integration before choosing from a list.'
        })
      );
    }

    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: d.callback.providerVariantOid }
    });
    let callbacks = await getCallbacksBackend(providerVariant);
    if (!callbacks) throw new ServiceError(badRequestError(callbacksNotSupported));

    let authConfig = callbackInstance.providerAuthConfigVersion?.authConfig ?? null;

    // The provider decides the page size and only pages forward.
    return Paginator.create<TriggerSelectionOption>(({ externalCursor }) =>
      externalCursor(async page => {
        let res = await callbacks.listTriggerSelectionOptions({
          tenant: scope.tenant,
          callbackInstance,
          listLinkableAuthConfigVersions: ({ providers }) =>
            this.listLinkableAuthConfigVersions({
              callbackInstance,
              authConfig,
              accessor,
              providers
            }),
          input: {
            triggerGroupKey: d.input.triggerGroupKey,
            field: d.input.field,
            query: d.input.search,
            pageToken: decodePageToken(page.cursor)
          }
        });

        return {
          items: res.options,
          nextCursor: encodePageToken({ source: res.source, value: res.nextPageToken })
        };
      })
    );
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
      previousCallback: toAuditCallback(d.callback),
      changedTriggerGroupKeys: changedTriggerGroupKeys(
        d.callback.triggerGroupSelections,
        callback.triggerGroupSelections
      )
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

    let selectionsChanged = false;
    let triggerGroupSelections: PrismaJson.TriggerGroupSelections | null = null;
    if (d.input.triggerGroupSelections !== undefined) {
      if (d.callback.ownership === 'managed') {
        throw new ServiceError(
          badRequestError({
            code: 'callback_managed',
            message: 'Trigger group selections cannot be changed on a managed callback.'
          })
        );
      }
      triggerGroupSelections =
        parseTriggerGroupSelections(d.input.triggerGroupSelections) ?? null;
      if (triggerGroupSelections) {
        assertSelectionsMatchTriggerGroups(
          triggerGroupSelections,
          d.callback.callbackInstances,
          d.callback.triggerGroupSelections
        );
      }
      selectionsChanged = !sameTriggerGroupSelections(
        d.callback.triggerGroupSelections,
        triggerGroupSelections
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

    let callback = await db.callback.update({
      where: { oid: d.callback.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        ...(selectionsChanged
          ? { triggerGroupSelections: triggerGroupSelections ?? Prisma.DbNull }
          : {})
      },
      include: callbackInclude
    });

    // Also when unchanged, so repeating a save recovers a reconcile that was never enqueued.
    if (d.input.triggerGroupSelections !== undefined) {
      await callbackInstanceReconcileManyQueue.add({
        integrationProviderId: callback.integrationProvider.id
      });
    }
    await indexCallbackQueue.add({ callbackId: callback.id });

    return callback;
  }

  // Connections without an owner are the ones shared across the project.
  private async listLinkableAuthConfigVersions(d: {
    callbackInstance: Pick<CallbackInstance, 'tenantOid' | 'environmentOid'>;
    authConfig: ProviderAuthConfig | null;
    accessor: OwnershipAccessor;
    providers: Pick<Provider, 'oid'>[];
  }) {
    if (
      !d.providers.length ||
      !d.authConfig ||
      d.authConfig.isSystemOwned ||
      d.authConfig.ownerPublicMcpServerOid
    ) {
      return [];
    }

    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        tenantOid: d.callbackInstance.tenantOid,
        environmentOid: d.callbackInstance.environmentOid,
        backendOid: d.authConfig.backendOid,
        providerOid: { in: d.providers.map(provider => provider.oid) },
        ownerActorOid: d.authConfig.ownerActorOid,
        ownerPublicMcpServerOid: null,
        isSystemOwned: false,
        isEphemeral: false,
        status: 'active',
        isParentDeleted: false,
        currentVersionOid: { not: null },
        ...ownedResourceWhere(d.accessor, { ownership: 'usable' })
      },
      include: { currentVersion: true },
      orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
      take: LINKABLE_AUTH_CONFIGS_MAX
    });

    return authConfigs.flatMap(authConfig =>
      authConfig.currentVersion ? [authConfig.currentVersion] : []
    );
  }
}

export let callbackService = Service.create(
  'callback',
  () => new callbackServiceImpl()
).build();
