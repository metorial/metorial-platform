import { redisKey } from '@mtsrc/agent-tracking-redis';

export let correlationCacheKey = (correlationKey: string) => redisKey('corr', correlationKey);

export let inferCacheKey = (inferKey: string) => redisKey('infer', inferKey);

export let summaryLockKey = (sessionKey: string) => redisKey('session', 'summary', sessionKey);
