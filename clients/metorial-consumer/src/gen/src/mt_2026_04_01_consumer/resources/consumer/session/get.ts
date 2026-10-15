import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerSessionGetOutput = {
  object: 'consumer.session';
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
};

export let mapConsumerSessionGetOutput =
  /* @__PURE__ */ mapObject<ConsumerSessionGetOutput>(
    ['created_at', 'expires_at', 'last_used_at'],
    1
  );
