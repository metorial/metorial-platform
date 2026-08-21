import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatIntegrationInstance,
  type ChatIntegrationInstanceProviderStatus,
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
  setAdapterInstanceProvider,
  type SetIntegrationInstanceProviderInput
} from '@metorial-subspace/module-integration';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { upsertChatInstanceProviderProjection } from '../lib/project';
import { enqueueChatIntegrationInstanceUpdated } from '../queues/lifecycle';

export let chatIntegrationInstanceProviderInclude = {
  chatIntegrationInstance: true,
  chatIntegrationProvider: true,
  adapterIntegrationInstanceProvider: true
} as const;

export type ListChatIntegrationInstanceProvidersParams = {
  search?: string;
  status?: ChatIntegrationInstanceProviderStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatIntegrationInstanceIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatIntegrationInstanceProviderByIdParams = {
  chatIntegrationInstanceProviderId: string;
  allowDeleted?: boolean;
};

export type SetChatIntegrationInstanceProviderParams = {
  chatIntegrationInstance: ChatIntegrationInstance;
  input: SetIntegrationInstanceProviderInput;
};

class chatIntegrationInstanceProviderServiceImpl {
  async listChatIntegrationInstanceProviders(
    d: MetorialFacing<ListChatIntegrationInstanceProvidersParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatIntegrationInstanceProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatIntegrationInstanceProvidersInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & ListChatIntegrationInstanceProvidersParams
  ) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatIntegrationInstanceProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).hasParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatIntegrationInstanceIds
                  ? { chatIntegrationInstance: { id: { in: d.chatIntegrationInstanceIds } } }
                  : undefined!,
                d.search
                  ? { name: { contains: d.search, mode: 'insensitive' as const } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatIntegrationInstanceProviderInclude
          })
      )
    );
  }

  async getChatIntegrationInstanceProviderById(
    d: MetorialFacing<GetChatIntegrationInstanceProviderByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatIntegrationInstanceProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatIntegrationInstanceProviderByIdInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetChatIntegrationInstanceProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatIntegrationInstanceProvider = await db.chatIntegrationInstanceProvider.findFirst({
      where: {
        id: d.chatIntegrationInstanceProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include: chatIntegrationInstanceProviderInclude
    });
    if (!chatIntegrationInstanceProvider) {
      throw new ServiceError(
        notFoundError(
          'chat.integration.instance.provider',
          d.chatIntegrationInstanceProviderId
        )
      );
    }

    return chatIntegrationInstanceProvider;
  }

  async setChatIntegrationInstanceProvider(
    d: MetorialFacing<SetChatIntegrationInstanceProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.setChatIntegrationInstanceProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async setChatIntegrationInstanceProviderInternal(
    d: { tenant: Tenant; environment: Environment } & SetChatIntegrationInstanceProviderParams
  ) {
    checkTenant(d, d.chatIntegrationInstance);

    return withTransaction(async db => {
      let adapterInstance = await db.adapterIntegrationInstance.findUniqueOrThrow({
        where: { oid: d.chatIntegrationInstance.adapterIntegrationInstanceOid }
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

      await enqueueChatIntegrationInstanceUpdated(d.chatIntegrationInstance.id);

      return db.chatIntegrationInstanceProvider.findMany({
        where: {
          chatIntegrationInstanceOid: d.chatIntegrationInstance.oid,
          status: 'active'
        },
        include: chatIntegrationInstanceProviderInclude
      });
    });
  }
}

export let chatIntegrationInstanceProviderService = Service.create(
  'chatIntegrationInstanceProvider',
  () => new chatIntegrationInstanceProviderServiceImpl()
).build();
