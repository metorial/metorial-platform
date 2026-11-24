import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ChatInstancesListOutput = {
  items: {
    object: 'chat.instance';
    id: string;
    status: 'draft' | 'active' | 'archived' | 'deleted';
    chatConnectionId: string;
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    identity: {
      id: string;
      userId: string;
      name: string;
      username: string;
      providerType: string;
      email: string | null;
      imageUrl: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapChatInstancesListOutput =
  /* @__PURE__ */ createMapper<ChatInstancesListOutput>(
    [
      7,
      [
        1,
        [
          'chat_connection_id',
          ['identity', 0, [1, ['user_id', 'provider_type', 'image_url']]],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ChatInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'draft'
    | 'active'
    | 'archived'
    | 'deleted'
    | ('draft' | 'active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  chatConnectionId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapChatInstancesListQuery =
  /* @__PURE__ */ createMapper<ChatInstancesListQuery>([
    3,
    [
      [
        0,
        [1, ['chat_connection_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]
      ]
    ]
  ]);
