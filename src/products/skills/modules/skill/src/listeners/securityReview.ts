import { Fabric } from '@metorial/fabric';
import { requestSecurityReview } from '@metorial-subspace/module-security-review-request';

Fabric.listen('skill.version.created:after', async ({ skillId }) => {
  await requestSecurityReview({ subject: 'skill', id: skillId, trigger: 'new_version' });
});

Fabric.listen('skill.import.item.completed:after', async ({ skillId }) => {
  await requestSecurityReview({
    subject: 'skill',
    id: skillId,
    trigger: 'skill_import',
    immediateAi: true
  });
});

Fabric.listen('skill.merge_request.audit.merged:after', async ({ mergeRequest }) => {
  await requestSecurityReview({
    subject: 'skill',
    id: mergeRequest.targetSkillId,
    trigger: 'new_version',
    reason: 'merge_request',
    immediateAi: true
  });
});

// The request processor re-reads the skill, so a status change only needs to reach it.
let syncSkillStatus = async ({ skill }: { skill: { id: string } }) => {
  await requestSecurityReview({
    subject: 'skill',
    id: skill.id,
    trigger: 'new_version',
    reason: 'skill_status_changed'
  });
};

Fabric.listen('skill.archived:after', syncSkillStatus);

Fabric.listen('skill.deleted:after', syncSkillStatus);
