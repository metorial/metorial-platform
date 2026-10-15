import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ChatInstancesSyncOutput = {
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
};

export let mapChatInstancesSyncOutput =
  /* @__PURE__ */ mapObject<ChatInstancesSyncOutput>(
    [
      'chat_connection_id',
      ['identity', 0, [1, ['user_id', 'provider_type', 'image_url']]],
      'created_at',
      'updated_at'
    ],
    1
  );
