import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatInstance,
  type ChatInstanceProviderStatus,
  db,
  type Environment,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  integrationInstanceProviderVersionInclude,
  integrationProviderVersionInclude,
  setAdapterInstanceProvider,
  type SetIntegrationInstanceProviderInput
} from '@metorial-subspace/module-integration';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { upsertChatInstanceProviderProjection } from '../lib/project';
import { enqueueChatInstanceUpdated } from '../queues/lifecycle';

export let chatInstanceProviderInclude = {
  chatInstance: true,
  chatConnectionProvider: true,
  author: true,
  adapterIntegrationInstanceProvider: {
    include: {
      integrationProvider: {
        include: {
          provider: {
            include: {
              defaultVariant: {
                include: {
                  currentVersion: {
                    include: {
                      specification: {
                        include: { providerTriggerGroups: true }
                      }
                    }
                  }
                }
              }
            }
          },
          currentVersion: { include: integrationProviderVersionInclude }
        }
      },
      integrationInstanceProvider: {
        include: {
          currentVersion: { include: integrationInstanceProviderVersionInclude }
        }
      }
    }
  }
} as const;

export type ListChatInstanceProvidersParams = {
  search?: string;
  status?: ChatInstanceProviderStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatInstanceIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatInstanceProviderByIdParams = {
  chatInstanceProviderId: string;
  allowDeleted?: boolean;
};

export type SetChatInstanceProviderParams = {
  chatInstance: ChatInstance;
  input: SetIntegrationInstanceProviderInput;
};

class chatInstanceProviderServiceImpl {
  async listChatInstanceProviders(d: MetorialFacing<ListChatInstanceProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatInstanceProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatInstanceProvidersInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & ListChatInstanceProvidersParams
  ) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.chatInstanceProvider.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatInstanceProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).hasParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatInstanceIds
                  ? { chatInstance: { id: { in: d.chatInstanceIds } } }
                  : undefined!,
                search ? { id: { in: search.map(result => result.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatInstanceProviderInclude
          })
      )
    );
  }

  async getChatInstanceProviderById(d: MetorialFacing<GetChatInstanceProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatInstanceProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatInstanceProviderByIdInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetChatInstanceProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatInstanceProvider = await db.chatInstanceProvider.findFirst({
      where: {
        id: d.chatInstanceProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: chatInstanceProviderInclude
    });
    if (!chatInstanceProvider) {
      throw new ServiceError(
        notFoundError('chat.integration.instance.provider', d.chatInstanceProviderId)
      );
    }

    return chatInstanceProvider;
  }

  async setChatInstanceProvider(d: MetorialFacing<SetChatInstanceProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.setChatInstanceProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async setChatInstanceProviderInternal(
    d: { tenant: Tenant; environment: Environment } & SetChatInstanceProviderParams
  ) {
    checkTenant(d, d.chatInstance);

    return withTransaction(async db => {
      let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
        where: { oid: d.chatInstance.adapterIntegrationInstanceOid }
      });

      let links = await setAdapterInstanceProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterInstance,
        input: d.input
      });

      for (let link of links) {
        await upsertChatInstanceProviderProjection(link);
      }

      await enqueueChatInstanceUpdated(d.chatInstance.id);

      return db.chatInstanceProvider.findMany({
        where: {
          chatInstanceOid: d.chatInstance.oid,
          status: 'active'
        },
        include: chatInstanceProviderInclude
      });
    });
  }
}

export let chatInstanceProviderService = Service.create(
  'chatInstanceProvider',
  () => new chatInstanceProviderServiceImpl()
).build();
