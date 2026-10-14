import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ChatsDmsOpenOutput = {
  object: 'chat.channel';
  id: string;
  chatId: string;
  workspaceId: string | null;
  type:
    | 'public'
    | 'private'
    | 'dm'
    | 'group_dm'
    | 'shared'
    | 'announcement'
    | 'forum'
    | 'unknown';
  providerType: string;
  providerChannelId: string;
  name: string | null;
  topic: string | null;
  subject: string | null;
  hasAccess: boolean;
  recipient: {
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
  memberCount: number | null;
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
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt: Date | null;
};

export let mapChatsDmsOpenOutput =
  /* @__PURE__ */ mapObject<ChatsDmsOpenOutput>(
    [
      'chat_id',
      'workspace_id',
      'provider_type',
      'provider_channel_id',
      'has_access',
      [
        'recipient',
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
      'member_count',
      'created_at',
      'updated_at',
      'last_interaction_at'
    ],
    1
  );

export type ChatsDmsOpenBody =
  | {
      type: 'single';
      user:
        | { type: 'email'; email: string }
        | { type: 'phone_number'; phoneNumber: string }
        | { type: 'generic'; userId: string };
    }
  | {
      type: 'group';
      users:
        | { type: 'email'; emails: string[] }
        | { type: 'phone_number'; phoneNumbers: string[] }
        | { type: 'generic'; userIds: string[] };
    };

export let mapChatsDmsOpenBody = /* @__PURE__ */ createMapper<ChatsDmsOpenBody>(
  [
    3,
    [
      [
        0,
        [
          1,
          [
            ['user', 0, [3, [[0, [1, ['phone_number', 'user_id']]]]]],
            ['users', 0, [3, [[0, [1, ['phone_numbers', 'user_ids']]]]]]
          ]
        ]
      ]
    ]
  ]
);
