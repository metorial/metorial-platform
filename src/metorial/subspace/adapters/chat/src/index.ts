import { AdapterClient, type AdapterClientParams } from '@metorial-subspace/adapter';
import { ChatAdapter } from '@slates/adapter-chat';

export interface ChatAdapterInstance extends AdapterClient<typeof ChatAdapter> {}

export class ChatAdapterClient {
  static create(params: AdapterClientParams): Promise<ChatAdapterInstance> {
    return AdapterClient.create({
      ...params,
      adapter: ChatAdapter
    });
  }
}
