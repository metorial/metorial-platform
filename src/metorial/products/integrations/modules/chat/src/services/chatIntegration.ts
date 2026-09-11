import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatIntegration,
  type ChatIntegrationStatus,
  db,
  type Environment,
  getId,
  type Integration,
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
  applyAdapterIntegrationPresentation,
  ensureAdapterIntegration,
  removeAdapterIntegration,
  resolveAdapterGlobal
} from '@metorial-subspace/module-integration';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  archiveChatIntegrationProjection,
  getSlug,
  projectChatFromAdapterIntegration
} from '../lib/project';
import {
  enqueueChatIntegrationArchived,
  enqueueChatIntegrationCreated,
  enqueueChatIntegrationUpdated
} from '../queues/lifecycle';

export let chatIntegrationInclude = {
  adapterIntegration: true
} as const;

export type ListChatIntegrationsParams = {
  search?: string;
  status?: ChatIntegrationStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  updatedAt?: DateFilter;
  createdAt?: DateFilter;
};

export type GetChatIntegrationByIdParams = {
  chatIntegrationId: string;
  allowDeleted?: boolean;
};

export type CreateChatIntegrationParams =
  | {
      mode: 'standalone';
      input: {
        name: string;
        description?: string;
        metadata?: Record<string, any>;
        privateMetadata?: Record<string, any>;
      };
    }
  | {
      mode: 'existing';
      integration: Integration;
      input?: {
        name?: string;
        description?: string;
        metadata?: Record<string, any>;
        privateMetadata?: Record<string, any>;
      };
    };

export type UpdateChatIntegrationParams = {
  chatIntegration: ChatIntegration;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

export type ArchiveChatIntegrationParams = {
  chatIntegration: ChatIntegration;
};

class chatIntegrationServiceImpl {
  async listChatIntegrations(d: MetorialFacing<ListChatIntegrationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatIntegrationsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatIntegrationsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatIntegrationsParams
  ) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatIntegration.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatIntegration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatIntegrationInclude
          })
      )
    );
  }

  async getChatIntegrationById(d: MetorialFacing<GetChatIntegrationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatIntegrationByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatIntegrationByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatIntegrationByIdParams
  ) {
    let solution = await getMetorialSolution();

    let chatIntegration = await db.chatIntegration.findFirst({
      where: {
        id: d.chatIntegrationId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: chatIntegrationInclude
    });
    if (!chatIntegration) {
      throw new ServiceError(notFoundError('chat.integration', d.chatIntegrationId));
    }

    return chatIntegration;
  }

  async createChatIntegration(d: MetorialFacing<CreateChatIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatIntegrationInternal({
      ...(rest as CreateChatIntegrationParams),
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatIntegrationParams
  ) {
    let adapterGlobal = await resolveAdapterGlobal('chat');

    return withTransaction(async db => {
      let adapterIntegration = await ensureAdapterIntegration(
        d.mode === 'standalone'
          ? {
              tenant: d.tenant,
              environment: d.environment,
              type: 'chat',
              adapterGlobal,
              isStandalone: true,
              presentation: { name: d.input.name }
            }
          : {
              tenant: d.tenant,
              environment: d.environment,
              type: 'chat',
              adapterGlobal,
              isStandalone: false,
              integration: d.integration
            }
      );

      let name =
        d.mode === 'standalone'
          ? d.input.name.trim()
          : d.input?.name?.trim() || adapterIntegration.integration.name;

      let existing = await db.chatIntegration.findUnique({
        where: { adapterIntegrationOid: adapterIntegration.oid }
      });

      let chatIntegration = existing
        ? await db.chatIntegration.update({
            where: { oid: existing.oid },
            data: {
              status: 'active',
              archivedAt: null,
              name,
              description:
                d.mode === 'standalone'
                  ? d.input.description?.trim() || null
                  : d.input?.description?.trim() || existing.description,
              metadata:
                d.mode === 'standalone'
                  ? (d.input.metadata ?? {})
                  : (d.input?.metadata ?? existing.metadata),
              privateMetadata:
                d.mode === 'standalone'
                  ? (d.input.privateMetadata ?? {})
                  : (d.input?.privateMetadata ?? existing.privateMetadata)
            },
            include: chatIntegrationInclude
          })
        : await db.chatIntegration.create({
            data: {
              ...getId('chatIntegration'),
              status: 'active',
              slug: getSlug(name),
              name,
              description:
                d.mode === 'standalone'
                  ? d.input.description?.trim() || null
                  : d.input?.description?.trim() || null,
              metadata:
                d.mode === 'standalone' ? (d.input.metadata ?? {}) : (d.input?.metadata ?? {}),
              privateMetadata:
                d.mode === 'standalone'
                  ? (d.input.privateMetadata ?? {})
                  : (d.input?.privateMetadata ?? {}),
              adapterIntegrationOid: adapterIntegration.oid,
              tenantOid: adapterIntegration.tenantOid,
              projectOid: adapterIntegration.projectOid,
              environmentOid: adapterIntegration.environmentOid,
              instanceOid: adapterIntegration.instanceOid,
              solutionOid: adapterIntegration.solutionOid
            },
            include: chatIntegrationInclude
          });

      await projectChatFromAdapterIntegration(adapterIntegration);

      if (existing) await enqueueChatIntegrationUpdated(chatIntegration.id);
      else await enqueueChatIntegrationCreated(chatIntegration.id);

      return chatIntegration;
    });
  }

  async updateChatIntegration(d: MetorialFacing<UpdateChatIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatIntegrationParams
  ) {
    checkTenant(d, d.chatIntegration);
    checkDeletedEdit(d.chatIntegration, 'update');

    return withTransaction(async db => {
      let chatIntegration = await db.chatIntegration.update({
        where: { oid: d.chatIntegration.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatIntegration.name,
          description:
            d.input.description === undefined
              ? d.chatIntegration.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined ? d.chatIntegration.metadata : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.chatIntegration.privateMetadata
              : d.input.privateMetadata
        },
        include: { ...chatIntegrationInclude }
      });

      if (d.input.name?.trim()) {
        await applyAdapterIntegrationPresentation({
          tenant: d.tenant,
          environment: d.environment,
          adapterIntegration: chatIntegration.adapterIntegration,
          name: d.input.name.trim()
        });
      }

      await enqueueChatIntegrationUpdated(chatIntegration.id);

      return chatIntegration;
    });
  }

  async archiveChatIntegration(d: MetorialFacing<ArchiveChatIntegrationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatIntegrationParams
  ) {
    checkTenant(d, d.chatIntegration);
    checkDeletedEdit(d.chatIntegration, 'archive');

    return withTransaction(async db => {
      await archiveChatIntegrationProjection(d.chatIntegration.adapterIntegrationOid);

      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatIntegration.adapterIntegrationOid }
      });

      await removeAdapterIntegration({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegration,
        cause: 'product'
      });

      await enqueueChatIntegrationArchived(d.chatIntegration.id);

      return db.chatIntegration.findUniqueOrThrow({
        where: { oid: d.chatIntegration.oid },
        include: chatIntegrationInclude
      });
    });
  }

  async deleteChatIntegration(d: MetorialFacing<ArchiveChatIntegrationParams>) {
    return this.archiveChatIntegration(d);
  }

  async deleteChatIntegrationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatIntegrationParams
  ) {
    return this.archiveChatIntegrationInternal(d);
  }
}

export let chatIntegrationService = Service.create(
  'chatIntegration',
  () => new chatIntegrationServiceImpl()
).build();
