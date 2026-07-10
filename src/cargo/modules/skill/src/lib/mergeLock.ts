import { createLock } from '@lowerdeck/lock';
import { env } from '@metorial-cargo/db';

export let skillMergeTargetLock = createLock({
  name: 'cargo/skill/merge',
  redisUrl: env.service.REDIS_URL
});

export let skillMergePairLock = createLock({
  name: 'cargo/skill/merge-pair',
  redisUrl: env.service.REDIS_URL
});

export let getCanonicalSkillPairKey = (firstSkillOid: bigint, secondSkillOid: bigint) =>
  firstSkillOid < secondSkillOid
    ? `${firstSkillOid}:${secondSkillOid}`
    : `${secondSkillOid}:${firstSkillOid}`;
