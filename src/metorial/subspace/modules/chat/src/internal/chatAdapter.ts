import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ChatAdapterClient, type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type ChatIntegrationInstanceProvider,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import { resolveAdapterInstanceProviderSession } from '@metorial-subspace/module-integration';
import { type InternalToolCallClient } from '@metorial-subspace/module-session';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

export type GetChatAdapterClientParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
  client: InternalToolCallClient;
};

class chatAdapterServiceImpl {
  async getChatAdapterClient(
    d: MetorialFacing<GetChatAdapterClientParams>
  ): Promise<ChatAdapterInstance> {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatAdapterClientInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatAdapterClientInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatAdapterClientParams
  ): Promise<ChatAdapterInstance> {
    checkTenant(d, d.chatIntegrationInstanceProvider);

    if (d.chatIntegrationInstanceProvider.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          code: 'chat_integration_instance_provider_archived',
          message: 'The chat integration instance provider is archived.'
        })
      );
    }

    let session = await resolveAdapterInstanceProviderSession({
      tenant: d.tenant,
      environment: d.environment,
      adapterInstanceProvider: {
        oid: d.chatIntegrationInstanceProvider.adapterIntegrationInstanceProviderOid
      }
    });

    return ChatAdapterClient.create({
      tenant: d.tenant,
      environment: d.environment,
      session,
      client: d.client
    });
  }
}

export let chatAdapterService: {
  getChatAdapterClient(
    d: MetorialFacing<GetChatAdapterClientParams>
  ): Promise<ChatAdapterInstance>;
  getChatAdapterClientInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatAdapterClientParams
  ): Promise<ChatAdapterInstance>;
} = Service.create('chatAdapterService', () => new chatAdapterServiceImpl()).build();
