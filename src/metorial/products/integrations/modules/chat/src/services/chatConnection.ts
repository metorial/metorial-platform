import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatConnection,
  type ChatConnectionStatus,
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
  integrationProviderVersionInclude,
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
  archiveChatConnectionProjection,
  getSlug,
  projectChatFromAdapterIntegration
} from '../lib/project';
import {
  enqueueChatConnectionArchived,
  enqueueChatConnectionCreated,
  enqueueChatConnectionUpdated
} from '../queues/lifecycle';
import {
  chatConnectionProviderService,
  type CreateChatConnectionProviderParams
} from './chatConnectionProvider';

export let chatConnectionInclude = {
  adapterIntegration: true,
  providers: {
    include: {
      adapterIntegrationProvider: {
        include: {
          integrationProvider: {
            include: {
              provider: true,
              currentVersion: { include: integrationProviderVersionInclude }
            }
          }
        }
      }
    }
  }
} as const;

export type ListChatConnectionsParams = {
  search?: string;
  status?: ChatConnectionStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  updatedAt?: DateFilter;
  createdAt?: DateFilter;
};

export type GetChatConnectionByIdParams = {
  chatConnectionId: string;
  allowDeleted?: boolean;
};

export type CreateChatConnectionParams =
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

export type CreateChatConnectionWithProviderParams = CreateChatConnectionParams & {
  provider: CreateChatConnectionProviderParams['input'];
};

// `MetorialFacing<T>` uses `Omit`, which isn't distributive over unions -- applied directly to
// this discriminated union it would collapse to only the fields common to every branch. Distribute
// it over each branch by hand instead.
type FacingCreateChatConnectionWithProviderParams =
  | MetorialFacing<Extract<CreateChatConnectionWithProviderParams, { mode: 'standalone' }>>
  | MetorialFacing<Extract<CreateChatConnectionWithProviderParams, { mode: 'existing' }>>;

export type UpdateChatConnectionParams = {
  chatConnection: ChatConnection;
  input: {
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

export type ArchiveChatConnectionParams = {
  chatConnection: ChatConnection;
};

class chatConnectionServiceImpl {
  async listChatConnections(d: MetorialFacing<ListChatConnectionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatConnectionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatConnectionsInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatConnectionsParams
  ) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatConnection.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatConnection.findMany({
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
            include: chatConnectionInclude
          })
      )
    );
  }

  async getChatConnectionById(d: MetorialFacing<GetChatConnectionByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatConnectionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatConnectionByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatConnectionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let chatConnection = await db.chatConnection.findFirst({
      where: {
        id: d.chatConnectionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: chatConnectionInclude
    });
    if (!chatConnection) {
      throw new ServiceError(notFoundError('chat.integration', d.chatConnectionId));
    }

    return chatConnection;
  }

  async createChatConnection(d: MetorialFacing<CreateChatConnectionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatConnectionInternal({
      ...(rest as CreateChatConnectionParams),
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatConnectionInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatConnectionParams
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

      let existing = await db.chatConnection.findUnique({
        where: { adapterIntegrationOid: adapterIntegration.oid }
      });

      let chatConnection = existing
        ? await db.chatConnection.update({
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
            include: chatConnectionInclude
          })
        : await db.chatConnection.create({
            data: {
              ...getId('chatConnection'),
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
            include: chatConnectionInclude
          });

      await projectChatFromAdapterIntegration(adapterIntegration);

      if (existing) await enqueueChatConnectionUpdated(chatConnection.id);
      else await enqueueChatConnectionCreated(chatConnection.id);

      return chatConnection;
    });
  }

  async createChatConnectionWithProvider(d: FacingCreateChatConnectionWithProviderParams) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatConnectionWithProviderInternal({
      ...(rest as CreateChatConnectionWithProviderParams),
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatConnectionWithProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatConnectionWithProviderParams
  ) {
    let { provider, ...createParams } = d;

    let chatConnection = await this.createChatConnectionInternal(
      createParams as { tenant: Tenant; environment: Environment } & CreateChatConnectionParams
    );

    await chatConnectionProviderService.createChatConnectionProviderInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatConnection,
      input: provider
    });

    return this.getChatConnectionByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatConnectionId: chatConnection.id
    });
  }

  async updateChatConnection(d: MetorialFacing<UpdateChatConnectionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatConnectionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatConnectionInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatConnectionParams
  ) {
    checkTenant(d, d.chatConnection);
    checkDeletedEdit(d.chatConnection, 'update');

    return withTransaction(async db => {
      let chatConnection = await db.chatConnection.update({
        where: { oid: d.chatConnection.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatConnection.name,
          description:
            d.input.description === undefined
              ? d.chatConnection.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined ? d.chatConnection.metadata : d.input.metadata,
          privateMetadata:
            d.input.privateMetadata === undefined
              ? d.chatConnection.privateMetadata
              : d.input.privateMetadata
        },
        include: { ...chatConnectionInclude }
      });

      if (d.input.name?.trim()) {
        await applyAdapterIntegrationPresentation({
          tenant: d.tenant,
          environment: d.environment,
          adapterIntegration: chatConnection.adapterIntegration,
          name: d.input.name.trim()
        });
      }

      await enqueueChatConnectionUpdated(chatConnection.id);

      return chatConnection;
    });
  }

  async archiveChatConnection(d: MetorialFacing<ArchiveChatConnectionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatConnectionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatConnectionInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatConnectionParams
  ) {
    checkTenant(d, d.chatConnection);
    checkDeletedEdit(d.chatConnection, 'archive');

    return withTransaction(async db => {
      await archiveChatConnectionProjection(d.chatConnection.adapterIntegrationOid);

      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatConnection.adapterIntegrationOid }
      });

      await removeAdapterIntegration({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegration,
        cause: 'product'
      });

      await enqueueChatConnectionArchived(d.chatConnection.id);

      return db.chatConnection.findUniqueOrThrow({
        where: { oid: d.chatConnection.oid },
        include: chatConnectionInclude
      });
    });
  }

  async deleteChatConnection(d: MetorialFacing<ArchiveChatConnectionParams>) {
    return this.archiveChatConnection(d);
  }

  async deleteChatConnectionInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatConnectionParams
  ) {
    return this.archiveChatConnectionInternal(d);
  }
}

export let chatConnectionService = Service.create(
  'chatConnection',
  () => new chatConnectionServiceImpl()
).build();
