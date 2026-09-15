import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatsThreadsGetOutput = {
  object: 'chat.thread';
  id: string;
  chatId: string;
  channelId: string;
  type: 'conversation' | 'dm' | 'post';
  providerType: string;
  providerThreadId: string;
  providerRootMessageId: string | null;
  subject: string | null;
  permalink: string | null;
  context: {
    type:
      | 'issue'
      | 'pull_request'
      | 'review'
      | 'page'
      | 'ticket'
      | 'post'
      | 'unknown';
    id: string;
    description?: string | undefined;
    status?: string | undefined;
    url?: string | undefined;
    author?: { id: string; name: string } | undefined;
    assignee?: { id: string; name: string } | undefined;
    labels?: string[] | undefined;
  } | null;
  replyCount: number | null;
  lastReplyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt: Date | null;
};

export let mapDashboardInstanceChatsThreadsGetOutput =
  mtMap.object<DashboardInstanceChatsThreadsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
    channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
    providerThreadId: mtMap.objectField(
      'provider_thread_id',
      mtMap.passthrough()
    ),
    providerRootMessageId: mtMap.objectField(
      'provider_root_message_id',
      mtMap.passthrough()
    ),
    subject: mtMap.objectField('subject', mtMap.passthrough()),
    permalink: mtMap.objectField('permalink', mtMap.passthrough()),
    context: mtMap.objectField(
      'context',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        author: mtMap.objectField(
          'author',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough())
          })
        ),
        assignee: mtMap.objectField(
          'assignee',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough())
          })
        ),
        labels: mtMap.objectField('labels', mtMap.array(mtMap.passthrough()))
      })
    ),
    replyCount: mtMap.objectField('reply_count', mtMap.passthrough()),
    lastReplyAt: mtMap.objectField('last_reply_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    lastInteractionAt: mtMap.objectField('last_interaction_at', mtMap.date())
  });

export type DashboardInstanceChatsThreadsGetQuery = { channelId: string };

export let mapDashboardInstanceChatsThreadsGetQuery =
  mtMap.object<DashboardInstanceChatsThreadsGetQuery>({
    channelId: mtMap.objectField('channel_id', mtMap.passthrough())
  });

