import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatConnection,
  type ChatInstance,
  type ChatInstanceStatus,
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
import { archiveChatsWhere } from '../lib/chatLifecycle';
import { upsertChatInstanceProjection } from '../lib/project';
import {
  enqueueChatInstanceArchived,
  enqueueChatInstanceCreated,
  enqueueChatInstanceUpdated
} from '../queues/lifecycle';

export let chatInstanceInclude = {
  chatConnection: true,
  adapterIntegrationInstance: true
} as const;

export type ListChatInstancesParams = {
  search?: string;
  status?: ChatInstanceStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatConnectionIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatInstanceByIdParams = {
  chatInstanceId: string;
  allowDeleted?: boolean;
};

export type CreateChatInstanceParams = {
  chatConnection: ChatConnection;
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

export type UpdateChatInstanceParams = {
  chatInstance: ChatInstance;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

export type ArchiveChatInstanceParams = {
  chatInstance: ChatInstance;
};

class chatInstanceServiceImpl {
  async listChatInstances(d: MetorialFacing<ListChatInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatInstancesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatInstancesInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatInstancesParams
  ) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatInstance.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).hasParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatConnectionIds
                  ? { chatConnection: { id: { in: d.chatConnectionIds } } }
                  : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatInstanceInclude
          })
      )
    );
  }

  async getChatInstanceById(
    d: MetorialFacing<GetChatInstanceByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatInstanceByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatInstanceByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatInstanceByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatInstance = await db.chatInstance.findFirst({
      where: {
        id: d.chatInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: chatInstanceInclude
    });
    if (!chatInstance) {
      throw new ServiceError(
        notFoundError('chat.integration.instance', d.chatInstanceId)
      );
    }

    return chatInstance;
  }

  async createChatInstance(d: MetorialFacing<CreateChatInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatInstanceParams
  ) {
    checkTenant(d, d.chatConnection);
    checkDeletedEdit(d.chatConnection, 'update');

    return withTransaction(async db => {
      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatConnection.adapterIntegrationOid }
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

      let existing = await db.chatInstance.findUnique({
        where: { adapterIntegrationInstanceOid: adapterInstance.oid }
      });

      let chatInstance = existing
        ? await db.chatInstance.update({
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
            include: chatInstanceInclude
          })
        : await db.chatInstance.create({
            data: {
              ...getId('chatInstance'),
              status,
              name,
              description: d.input?.description?.trim() || null,
              metadata: d.input?.metadata ?? {},
              privateMetadata: d.input?.privateMetadata ?? {},
              chatConnectionOid: d.chatConnection.oid,
              adapterIntegrationInstanceOid: adapterInstance.oid,
              adapterIntegrationOid: adapterIntegration.oid,
              tenantOid: adapterInstance.tenantOid,
              projectOid: adapterInstance.projectOid,
              environmentOid: adapterInstance.environmentOid,
              instanceOid: adapterInstance.instanceOid,
              solutionOid: adapterInstance.solutionOid
            },
            include: chatInstanceInclude
          });

      await upsertChatInstanceProjection(adapterInstance, d.input);

      if (existing) await enqueueChatInstanceUpdated(chatInstance.id);
      else await enqueueChatInstanceCreated(chatInstance.id);

      return chatInstance;
    });
  }

  async updateChatInstance(d: MetorialFacing<UpdateChatInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatInstanceParams
  ) {
    checkTenant(d, d.chatInstance);
    checkDeletedEdit(d.chatInstance, 'update');

    return withTransaction(async db => {
      let chatInstance = await db.chatInstance.update({
        where: { oid: d.chatInstance.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatInstance.name,
          description:
            d.input.description === undefined
              ? d.chatInstance.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.chatInstance.metadata
              : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.chatInstance.privateMetadata
              : d.input.privateMetadata
        },
        include: chatInstanceInclude
      });

      if (d.input.name?.trim()) {
        let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
          where: { oid: d.chatInstance.adapterIntegrationInstanceOid }
        });
        await applyAdapterInstancePresentation({
          tenant: d.tenant,
          environment: d.environment,
          adapterInstance,
          name: d.input.name.trim()
        });
      }

      await enqueueChatInstanceUpdated(chatInstance.id);

      return chatInstance;
    });
  }

  async archiveChatInstance(
    d: MetorialFacing<ArchiveChatInstanceParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatInstanceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatInstanceParams
  ) {
    checkTenant(d, d.chatInstance);
    checkDeletedEdit(d.chatInstance, 'archive');

    return withTransaction(async db => {
      let archivedAt = new Date();

      await db.chatInstanceProvider.updateMany({
        where: {
          chatInstanceOid: d.chatInstance.oid,
          status: { not: 'deleted' }
        },
        data: { status: 'archived', archivedAt, isParentDeleted: true }
      });
      await archiveChatsWhere(
        { chatInstanceOid: d.chatInstance.oid },
        archivedAt
      );

      await db.chatInstance.update({
        where: { oid: d.chatInstance.oid },
        data: { status: 'archived', archivedAt }
      });

      let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
        where: { oid: d.chatInstance.adapterIntegrationInstanceOid }
      });

      await removeAdapterInstance({
        tenant: d.tenant,
        environment: d.environment,
        adapterInstance,
        cause: 'product'
      });

      await enqueueChatInstanceArchived(d.chatInstance.id);

      return db.chatInstance.findUniqueOrThrow({
        where: { oid: d.chatInstance.oid },
        include: chatInstanceInclude
      });
    });
  }

  async deleteChatInstance(
    d: MetorialFacing<ArchiveChatInstanceParams>
  ) {
    return this.archiveChatInstance(d);
  }

  async deleteChatInstanceInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatInstanceParams
  ) {
    return this.archiveChatInstanceInternal(d);
  }
}

export let chatInstanceService = Service.create(
  'chatInstance',
  () => new chatInstanceServiceImpl()
).build();
