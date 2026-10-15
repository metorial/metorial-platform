import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatsMessagesReadOutput = {
  object: 'chat.message';
  id: string;
  chatId: string;
  channelId: string;
  threadId: string | null;
  providerType: string;
  providerMessageId: string;
  providerReplyToMessageId: string | null;
  author: {
    object: 'chat.author';
    id: string;
    chatId: string;
    type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
    role: 'member' | 'guest' | 'unknown';
    providerType: string;
    providerAuthorId: string;
    userName: string;
    fullName: string;
    email: string | null;
    imageUrl: string | null;
    isSelf: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastInteractionAt: Date | null;
  } | null;
  body: Record<string, any> | null;
  reactions:
    | {
        emoji:
          | { type: 'unicode'; value: string }
          | {
              type: 'custom';
              name: string;
              url?: string | undefined;
              id?: string | undefined;
            };
        count: number;
        authors?:
          | {
              userId: string;
              userName: string;
              fullName: string;
              type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
              role?: 'member' | 'guest' | 'unknown' | undefined;
              providerType?: string | undefined;
              isMe: boolean;
              email?: string | undefined;
              imageUrl?: string | undefined;
              raw?: any | undefined;
            }[]
          | undefined;
      }[]
    | null;
  unfurls:
    | {
        url: string;
        title?: string | undefined;
        description?: string | undefined;
        imageUrl?: string | undefined;
        siteName?: string | undefined;
        messageId?: string | undefined;
      }[]
    | null;
  attachments: {
    object: 'chat.message_attachment';
    id: string;
    providerAttachmentId: string | null;
    type: string;
    name: string | null;
    mimeType: string | null;
    size: number | null;
    width: number | null;
    height: number | null;
    position: number;
    fileId: string;
    downloadUrl: string | null;
    createdAt: Date;
  }[];
  sentAt: Date;
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt: Date | null;
  deletedAt: Date | null;
};

export let mapManagementInstanceChatsMessagesReadOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsMessagesReadOutput>(
    [
      'chat_id',
      'channel_id',
      'thread_id',
      'provider_type',
      'provider_message_id',
      'provider_reply_to_message_id',
      [
        'author',
        0,
        [
          1,
          [
            'chat_id',
            'provider_type',
            'provider_author_id',
            'user_name',
            'full_name',
            'image_url',
            'is_self',
            'created_at',
            'updated_at',
            'last_interaction_at'
          ]
        ]
      ],
      [
        'attachments',
        0,
        [
          2,
          [
            1,
            [
              'provider_attachment_id',
              'mime_type',
              'file_id',
              'download_url',
              'created_at'
            ]
          ]
        ]
      ],
      'sent_at',
      'edited_at',
      'created_at',
      'updated_at',
      'last_interaction_at',
      'deleted_at'
    ],
    1
  );

export type ManagementInstanceChatsMessagesReadBody = {
  channelId: string;
  threadId?: string | undefined;
};

export let mapManagementInstanceChatsMessagesReadBody =
  /* @__PURE__ */ mapObject<ManagementInstanceChatsMessagesReadBody>([
    'channel_id',
    'thread_id'
  ]);
