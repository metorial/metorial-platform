import { AdapterClient, type AdapterClientParams } from '@metorial-subspace/adapter';
import { ChatAdapter } from '@slates/adapter-chat';

export type {
  Author,
  AuthorRole,
  AuthorType,
  Channel,
  ChannelType,
  ChatBody,
  ChatPart,
  EmojiInput,
  LinkUnfurl,
  Message,
  MessageMetadata,
  MessageResult,
  ReactionCount,
  ReplyRef,
  Thread,
  ThreadType,
  Workspace
} from '@slates/adapter-chat';

export interface ChatAdapterInstance extends AdapterClient<typeof ChatAdapter> {}

export class ChatAdapterClient {
  static create(params: AdapterClientParams): Promise<ChatAdapterInstance> {
    return AdapterClient.create({
      ...params,
      adapter: ChatAdapter
    });
  }
}
