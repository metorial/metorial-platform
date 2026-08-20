import { AdapterClient, type AdapterClientParams } from '@metorial-subspace/adapter';
import { ChatAdapter } from '@slates/adapter-chat';

export class ChatAdapterClient {
  static create(params: AdapterClientParams) {
    return AdapterClient.create({
      ...params,
      adapter: ChatAdapter
    });
  }
}
