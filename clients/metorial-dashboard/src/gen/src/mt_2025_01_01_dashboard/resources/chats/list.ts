import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ChatsListOutput = {
  items: {
    object: 'chat';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    chatConnectionId: string;
    chatInstanceId: string;
    chatInstanceProviderId: string;
    providerId: string;
    workspaceId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapChatsListOutput = /* @__PURE__ */ createMapper<ChatsListOutput>(
  [
    7,
    [
      1,
      [
        'chat_connection_id',
        'chat_instance_id',
        'chat_instance_provider_id',
        'provider_id',
        'workspace_id',
        'created_at',
        'updated_at'
      ]
    ]
  ],
  1
);

export type ChatsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  id?: string | string[] | undefined;
  chatConnectionId?: string | string[] | undefined;
  chatInstanceId?: string | string[] | undefined;
  chatInstanceProviderId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapChatsListQuery = /* @__PURE__ */ createMapper<ChatsListQuery>([
  3,
  [
    [
      0,
      [
        1,
        [
          'chat_connection_id',
          'chat_instance_id',
          'chat_instance_provider_id',
          ['created_at', 1, 5],
          ['updated_at', 1, 5]
        ]
      ]
    ]
  ]
]);
