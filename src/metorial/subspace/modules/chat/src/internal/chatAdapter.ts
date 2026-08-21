import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ChatAdapterClient, type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type ChatIntegrationInstanceProvider,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import { resolveAdapterInstanceProviderSession } from '@metorial-subspace/module-integration';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

export type GetChatAdapterClientParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
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
      client: {
        identifier: 'chat_providers',
        name: 'Metorial - Chat Providers'
      }
    });
  }
}

// Ugly as fuck, but I had to since the ChatAdapterInstance type is too large
// to be inferred from the class. I apologize, Typescript it to blame.
export let chatAdapterService: {
  getChatAdapterClient(
    d: MetorialFacing<GetChatAdapterClientParams>
  ): Promise<ChatAdapterInstance>;
  getChatAdapterClientInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatAdapterClientParams
  ): Promise<ChatAdapterInstance>;
} = Service.create('chatAdapterService', () => new chatAdapterServiceImpl()).build();
