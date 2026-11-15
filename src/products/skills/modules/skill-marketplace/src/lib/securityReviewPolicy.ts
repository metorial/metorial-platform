import { db, type SkillConfiguration } from '@metorial/db';
import { getSkillSecurityVerdicts } from '@metorial-subspace/module-security-review-request';
import { combineConfigs } from './combineConfigs';

type PolicySkill = {
  skill: { id: string };
  skillConfiguration?: SkillConfiguration | null;
};

// Dismissed reviews and skills that were never reviewed are not enforced. Pending skills are
// only held back when the project opts in, so the deferred AI review doesn't delay shipping.
export let getWithheldSkillIds = async (d: {
  projectOid: bigint;
  instanceOid: bigint;
  skills: PolicySkill[];
  configs: (SkillConfiguration | null | undefined)[];
}) => {
  if (!d.skills.length) return new Set<string>();

  let defaultConfig = await db.skillConfiguration.findFirst({
    where: { projectOid: d.projectOid, instanceOid: d.instanceOid, isDefault: true }
  });

  let blockedSkillIds = d.skills
    .filter(
      entry =>
        combineConfigs([...d.configs, entry.skillConfiguration], defaultConfig)
          .securityReviewPolicy == 'block'
    )
    .map(entry => entry.skill.id);
  if (!blockedSkillIds.length) return new Set<string>();

  let [verdicts, project] = await Promise.all([
    getSkillSecurityVerdicts({ skillIds: blockedSkillIds }),
    db.project.findUniqueOrThrow({
      where: { oid: d.projectOid },
      select: { skillReviewHoldPending: true }
    })
  ]);

  return new Set(
    blockedSkillIds.filter(skillId => {
      let verdict = verdicts.get(skillId);

      return verdict == 'fail' || (verdict == 'pending' && project.skillReviewHoldPending);
    })
  );
};
