import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerSessionLogoutOutput = {
  object: 'consumer.session';
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
};

export let mapConsumerSessionLogoutOutput =
  /* @__PURE__ */ mapObject<ConsumerSessionLogoutOutput>(
    ['created_at', 'expires_at', 'last_used_at'],
    1
  );
