import type { SessionDataRetentionLevel } from '@metorial-subspace/db';

export interface RetentionSource {
  dataRetentionLevel: SessionDataRetentionLevel;
  storeToolCallAttachments: boolean;
  collectErrors: boolean;
}

export interface RetentionPolicy {
  level: SessionDataRetentionLevel;
  storeContent: boolean;
  storeToolIdentity: boolean;
  collectErrors: boolean;
  storeErrorPayload: boolean;
  storeToolCallAttachments: boolean;
  runContentAnalysis: boolean;
  offloadToStorage: boolean;
}

export let getRetentionPolicy = (session: RetentionSource): RetentionPolicy => {
  let level: SessionDataRetentionLevel =
    session.dataRetentionLevel === 'intent_only' || session.dataRetentionLevel === 'none'
      ? session.dataRetentionLevel
      : 'full';

  let isFull = level === 'full';
  let isNone = level === 'none';

  return {
    level,

    storeContent: isFull,
    storeToolIdentity: !isNone,

    collectErrors: isFull ? true : session.collectErrors !== false,
    storeErrorPayload: isFull,

    storeToolCallAttachments: isNone ? false : session.storeToolCallAttachments,

    runContentAnalysis: isFull,
    offloadToStorage: isFull
  };
};
