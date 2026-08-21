import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatIntegration,
  type ChatIntegrationProvider,
  type ChatIntegrationProviderStatus,
  db,
  type Environment,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  ensureAdapterProvider,
  removeAdapterProvider,
  updateAdapterProvider
} from '@metorial-subspace/module-integration';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { upsertChatProviderProjection } from '../lib/project';
import { enqueueChatIntegrationUpdated } from '../queues/lifecycle';

export let chatIntegrationProviderInclude = {
  chatIntegration: true,
  adapterIntegrationProvider: true
} as const;

export type ListChatIntegrationProvidersParams = {
  search?: string;
  status?: ChatIntegrationProviderStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatIntegrationIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatIntegrationProviderByIdParams = {
  chatIntegrationProviderId: string;
  allowDeleted?: boolean;
};

export type CreateChatIntegrationProviderParams = {
  chatIntegration: ChatIntegration;
  input: {
    providerId: string;
    providerDeploymentId?: string | null;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    toolFilters?: any;
  };
};

export type UpdateChatIntegrationProviderParams = {
  chatIntegrationProvider: ChatIntegrationProvider;
  input: {
    providerDeploymentId?: string;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    toolFilters?: any;
  };
};

export type ArchiveChatIntegrationProviderParams = {
  chatIntegrationProvider: ChatIntegrationProvider;
};

class chatIntegrationProviderServiceImpl {
  async listChatIntegrationProviders(d: MetorialFacing<ListChatIntegrationProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatIntegrationProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatIntegrationProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatIntegrationProvidersParams
  ) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatIntegrationProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatIntegrationIds
                  ? { chatIntegration: { id: { in: d.chatIntegrationIds } } }
                  : undefined!,
                d.search
                  ? { name: { contains: d.search, mode: 'insensitive' as const } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatIntegrationProviderInclude
          })
      )
    );
  }

  async getChatIntegrationProviderById(
    d: MetorialFacing<GetChatIntegrationProviderByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatIntegrationProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatIntegrationProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatIntegrationProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatIntegrationProvider = await db.chatIntegrationProvider.findFirst({
      where: {
        id: d.chatIntegrationProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: chatIntegrationProviderInclude
    });
    if (!chatIntegrationProvider) {
      throw new ServiceError(
        notFoundError('chat.integration.provider', d.chatIntegrationProviderId)
      );
    }

    return chatIntegrationProvider;
  }

  async createChatIntegrationProvider(d: MetorialFacing<CreateChatIntegrationProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatIntegrationProviderParams
  ) {
    checkTenant(d, d.chatIntegration);
    checkDeletedEdit(d.chatIntegration, 'update');

    return withTransaction(async db => {
      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatIntegration.adapterIntegrationOid }
      });

      let adapterProvider = await ensureAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegration,
        input: d.input
      });

      let existing = await db.chatIntegrationProvider.findUnique({
        where: { adapterIntegrationProviderOid: adapterProvider.oid }
      });

      let chatIntegrationProvider = existing
        ? await db.chatIntegrationProvider.update({
            where: { oid: existing.oid },
            data: {
              status: 'active',
              archivedAt: null,
              name: d.input.name?.trim() || existing.name,
              description: d.input.description?.trim() || existing.description,
              metadata: d.input.metadata ?? existing.metadata
            },
            include: chatIntegrationProviderInclude
          })
        : await db.chatIntegrationProvider.create({
            data: {
              ...getId('chatIntegrationProvider'),
              status: 'active',
              name: d.input.name?.trim() || 'Provider',
              description: d.input.description?.trim() || null,
              metadata: d.input.metadata ?? {},
              chatIntegrationOid: d.chatIntegration.oid,
              adapterIntegrationOid: adapterIntegration.oid,
              adapterIntegrationProviderOid: adapterProvider.oid,
              tenantOid: adapterProvider.tenantOid,
              projectOid: adapterProvider.projectOid,
              environmentOid: adapterProvider.environmentOid,
              instanceOid: adapterProvider.instanceOid,
              solutionOid: adapterProvider.solutionOid
            },
            include: chatIntegrationProviderInclude
          });

      await upsertChatProviderProjection(adapterProvider);

      await enqueueChatIntegrationUpdated(d.chatIntegration.id);

      return chatIntegrationProvider;
    });
  }

  async updateChatIntegrationProvider(d: MetorialFacing<UpdateChatIntegrationProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatIntegrationProviderParams
  ) {
    checkTenant(d, d.chatIntegrationProvider);
    checkDeletedEdit(d.chatIntegrationProvider, 'update');

    return withTransaction(async db => {
      let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
        where: { oid: d.chatIntegrationProvider.adapterIntegrationProviderOid }
      });

      await updateAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegrationProvider: adapterProvider,
        input: d.input
      });

      let updated = await db.chatIntegrationProvider.update({
        where: { oid: d.chatIntegrationProvider.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatIntegrationProvider.name,
          description:
            d.input.description === undefined
              ? d.chatIntegrationProvider.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.chatIntegrationProvider.metadata
              : d.input.metadata
        },
        include: chatIntegrationProviderInclude
      });

      await enqueueChatIntegrationUpdated(updated.chatIntegration.id);

      return updated;
    });
  }

  async archiveChatIntegrationProvider(
    d: MetorialFacing<ArchiveChatIntegrationProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatIntegrationProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatIntegrationProviderParams
  ) {
    checkTenant(d, d.chatIntegrationProvider);
    checkDeletedEdit(d.chatIntegrationProvider, 'archive');

    return withTransaction(async db => {
      let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
        where: { oid: d.chatIntegrationProvider.adapterIntegrationProviderOid }
      });

      await db.chatIntegrationProvider.update({
        where: { oid: d.chatIntegrationProvider.oid },
        data: { status: 'archived', archivedAt: new Date() }
      });

      await removeAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegrationProvider: adapterProvider
      });

      let archived = await db.chatIntegrationProvider.findUniqueOrThrow({
        where: { oid: d.chatIntegrationProvider.oid },
        include: chatIntegrationProviderInclude
      });
      await enqueueChatIntegrationUpdated(archived.chatIntegration.id);
      return archived;
    });
  }
}

export let chatIntegrationProviderService = Service.create(
  'chatIntegrationProvider',
  () => new chatIntegrationProviderServiceImpl()
).build();
