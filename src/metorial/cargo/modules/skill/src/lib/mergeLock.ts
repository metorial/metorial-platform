import { createLock } from '@lowerdeck/lock';
import { getConfig } from '@metorial/config';
import type { SkillMergeRequestDirection } from '@metorial/db';

export let skillMergeTargetLock = createLock({
  name: 'cargo/skill/merge',
  redisUrl: getConfig().redisUrl
});

export let skillMergePairLock = createLock({
  name: 'cargo/skill/merge-pair',
  redisUrl: getConfig().redisUrl
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
