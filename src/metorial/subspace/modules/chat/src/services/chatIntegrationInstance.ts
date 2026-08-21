import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatIntegration,
  type ChatIntegrationInstance,
  type ChatIntegrationInstanceStatus,
  db,
  type Environment,
  getId,
  type IntegrationInstance,
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
  applyAdapterInstancePresentation,
  ensureAdapterInstance,
  removeAdapterInstance,
  type SetIntegrationInstanceProviderInput
} from '@metorial-subspace/module-integration';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { upsertChatInstanceProjection } from '../lib/project';
import {
  enqueueChatIntegrationInstanceArchived,
  enqueueChatIntegrationInstanceCreated,
  enqueueChatIntegrationInstanceUpdated
} from '../queues/lifecycle';

export let chatIntegrationInstanceInclude = {
  chatIntegration: true,
  adapterIntegrationInstance: true
} as const;

export type ListChatIntegrationInstancesParams = {
  search?: string;
  status?: ChatIntegrationInstanceStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatIntegrationIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatIntegrationInstanceByIdParams = {
  chatIntegrationInstanceId: string;
  allowDeleted?: boolean;
};

export type CreateChatIntegrationInstanceParams = {
  chatIntegration: ChatIntegration;
  integrationInstance?: IntegrationInstance;
  createStandaloneInstance?: {
    name?: string;
    identity?: { identityActorId?: string | null; identityId?: string | null };
    providers?: SetIntegrationInstanceProviderInput[];
  };
  input?: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
  };
};

export type UpdateChatIntegrationInstanceParams = {
  chatIntegrationInstance: ChatIntegrationInstance;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

export type ArchiveChatIntegrationInstanceParams = {
  chatIntegrationInstance: ChatIntegrationInstance;
};

class chatIntegrationInstanceServiceImpl {
  async listChatIntegrationInstances(d: MetorialFacing<ListChatIntegrationInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatIntegrationInstancesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatIntegrationInstancesInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatIntegrationInstancesParams
  ) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatIntegrationInstance.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatIntegrationInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).hasParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatIntegrationIds
                  ? { chatIntegration: { id: { in: d.chatIntegrationIds } } }
                  : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatIntegrationInstanceInclude
          })
      )
    );
  }

  async getChatIntegrationInstanceById(
    d: MetorialFacing<GetChatIntegrationInstanceByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatIntegrationInstanceByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatIntegrationInstanceByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatIntegrationInstanceByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatIntegrationInstance = await db.chatIntegrationInstance.findFirst({
      where: {
        id: d.chatIntegrationInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: chatIntegrationInstanceInclude
    });
    if (!chatIntegrationInstance) {
      throw new ServiceError(
        notFoundError('chat.integration.instance', d.chatIntegrationInstanceId)
      );
    }

    return chatIntegrationInstance;
  }

  async createChatIntegrationInstance(d: MetorialFacing<CreateChatIntegrationInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatIntegrationInstanceParams
  ) {
    checkTenant(d, d.chatIntegration);
    checkDeletedEdit(d.chatIntegration, 'update');

    return withTransaction(async db => {
      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatIntegration.adapterIntegrationOid }
      });

      let adapterInstance = await ensureAdapterInstance({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegration,
        integrationInstance: d.integrationInstance,
        createStandaloneInstance: d.createStandaloneInstance
      });

      let name = d.input?.name?.trim() || adapterInstance.integrationInstance.name;
      let status =
        adapterInstance.status === 'draft' || adapterInstance.status === 'active'
          ? adapterInstance.status
          : ('active' as const);

      let existing = await db.chatIntegrationInstance.findUnique({
        where: { adapterIntegrationInstanceOid: adapterInstance.oid }
      });

      let chatIntegrationInstance = existing
        ? await db.chatIntegrationInstance.update({
            where: { oid: existing.oid },
            data: {
              status,
              archivedAt: null,
              isParentDeleted: false,
              name,
              description: d.input?.description?.trim() || existing.description,
              metadata: d.input?.metadata ?? existing.metadata,
              privateMetadata: d.input?.privateMetadata ?? existing.privateMetadata
            },
            include: chatIntegrationInstanceInclude
          })
        : await db.chatIntegrationInstance.create({
            data: {
              ...getId('chatIntegrationInstance'),
              status,
              name,
              description: d.input?.description?.trim() || null,
              metadata: d.input?.metadata ?? {},
              privateMetadata: d.input?.privateMetadata ?? {},
              chatIntegrationOid: d.chatIntegration.oid,
              adapterIntegrationInstanceOid: adapterInstance.oid,
              adapterIntegrationOid: adapterIntegration.oid,
              tenantOid: adapterInstance.tenantOid,
              projectOid: adapterInstance.projectOid,
              environmentOid: adapterInstance.environmentOid,
              instanceOid: adapterInstance.instanceOid,
              solutionOid: adapterInstance.solutionOid
            },
            include: chatIntegrationInstanceInclude
          });

      await upsertChatInstanceProjection(adapterInstance, d.input);

      if (existing) await enqueueChatIntegrationInstanceUpdated(chatIntegrationInstance.id);
      else await enqueueChatIntegrationInstanceCreated(chatIntegrationInstance.id);

      return chatIntegrationInstance;
    });
  }

  async updateChatIntegrationInstance(d: MetorialFacing<UpdateChatIntegrationInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatIntegrationInstanceParams
  ) {
    checkTenant(d, d.chatIntegrationInstance);
    checkDeletedEdit(d.chatIntegrationInstance, 'update');

    return withTransaction(async db => {
      let chatIntegrationInstance = await db.chatIntegrationInstance.update({
        where: { oid: d.chatIntegrationInstance.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatIntegrationInstance.name,
          description:
            d.input.description === undefined
              ? d.chatIntegrationInstance.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.chatIntegrationInstance.metadata
              : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.chatIntegrationInstance.privateMetadata
              : d.input.privateMetadata
        },
        include: chatIntegrationInstanceInclude
      });

      if (d.input.name?.trim()) {
        let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
          where: { oid: d.chatIntegrationInstance.adapterIntegrationInstanceOid }
        });
        await applyAdapterInstancePresentation({
          tenant: d.tenant,
          environment: d.environment,
          adapterInstance,
          name: d.input.name.trim()
        });
      }

      await enqueueChatIntegrationInstanceUpdated(chatIntegrationInstance.id);

      return chatIntegrationInstance;
    });
  }

  async archiveChatIntegrationInstance(
    d: MetorialFacing<ArchiveChatIntegrationInstanceParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatIntegrationInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatIntegrationInstanceParams
  ) {
    checkTenant(d, d.chatIntegrationInstance);
    checkDeletedEdit(d.chatIntegrationInstance, 'archive');

    return withTransaction(async db => {
      await db.chatIntegrationInstanceProvider.updateMany({
        where: {
          chatIntegrationInstanceOid: d.chatIntegrationInstance.oid,
          status: { not: 'deleted' }
        },
        data: { status: 'archived', archivedAt: new Date(), isParentDeleted: true }
      });

      await db.chatIntegrationInstance.update({
        where: { oid: d.chatIntegrationInstance.oid },
        data: { status: 'archived', archivedAt: new Date() }
      });

      let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
        where: { oid: d.chatIntegrationInstance.adapterIntegrationInstanceOid }
      });

      await removeAdapterInstance({
        tenant: d.tenant,
        environment: d.environment,
        adapterInstance,
        cause: 'product'
      });

      await enqueueChatIntegrationInstanceArchived(d.chatIntegrationInstance.id);

      return db.chatIntegrationInstance.findUniqueOrThrow({
        where: { oid: d.chatIntegrationInstance.oid },
        include: chatIntegrationInstanceInclude
      });
    });
  }

  async deleteChatIntegrationInstance(
    d: MetorialFacing<ArchiveChatIntegrationInstanceParams>
  ) {
    return this.archiveChatIntegrationInstance(d);
  }

  async deleteChatIntegrationInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatIntegrationInstanceParams
  ) {
    return this.archiveChatIntegrationInstanceInternal(d);
  }
}

export let chatIntegrationInstanceService = Service.create(
  'chatIntegrationInstance',
  () => new chatIntegrationInstanceServiceImpl()
).build();
