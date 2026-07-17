import { createLock } from '@lowerdeck/lock';
import type { SkillMergeRequestDirection } from '@metorial-cargo/db';
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

export let getSkillMergeRequestActivePairKey = (
  firstSkillOid: bigint,
  secondSkillOid: bigint,
  direction: SkillMergeRequestDirection
) => `${getCanonicalSkillPairKey(firstSkillOid, secondSkillOid)}:${direction}`;
