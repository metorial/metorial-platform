import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { skillService } from '@metorial/module-skill';
import { skillGroupService } from '@metorial/module-skill-groups';
import { ConsumerProfile, Instance, Project } from '@metorial/db';
import type { AnyAccessTagSelector, ResourceAuthorization } from '@metorial/module-access';

export let assertConsumerCanWriteSkillGroupItem = async (d: {
  project: Project;
  instance: Instance;
  skillGroupId: string;
  skillId: string;
  consumerProfile?: ConsumerProfile;
  accessTags?: AnyAccessTagSelector;
  authorization: ResourceAuthorization;
}) => {
  if (!d.consumerProfile) return;

  let [skillGroup, skill] = await Promise.all([
    skillGroupService.getSkillGroupById({
      project: d.project,
      instance: d.instance,
      skillGroupId: d.skillGroupId,
      accessTags: d.accessTags
    }),
    skillService.getSkillById({
      project: d.project,
      instance: d.instance,
      skillId: d.skillId,
      allowDeleted: true,
      accessTags: d.accessTags
    })
  ]);
  if (!skillGroup.allowConsumerSkillAssignment) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Consumers are not allowed to assign skills to this group.'
      })
    );
  }

  await skillService.assertSkillWriteAccess({
    project: d.project,
    instance: d.instance,
    skill,
    authorization: d.authorization
  });
};
