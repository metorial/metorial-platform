import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { skillService } from '@metorial/module-skill';
import { skillGroupService } from '@metorial/module-skill-groups';
import { skillStoreResource } from '@metorial/module-store';
import { ConsumerProfile, Instance, Project } from '@metorial/db';
import type { AnyAccessTagSelector, ResourceAuthorization } from '@metorial/module-access';

export let assertConsumerCanWriteSkillGroupItem = async (d: {
  project: Project;
  instance: Instance;
  skillGroupId: string;
  skillId: string;
  action: 'add' | 'remove';
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

  let groupLevel = await skillGroupService.getSkillGroupAccessLevel({
    skillGroup,
    accessTags: d.accessTags ?? []
  });
  let canEditGroup = groupLevel == 'write' || groupLevel == 'manage';
  if (!skillGroup.allowConsumerSkillAssignment && !canEditGroup) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Consumers are not allowed to assign skills to this group.'
      })
    );
  }

  if (d.action == 'remove' && canEditGroup) return;

  await skillService.assertSkillWriteAccess({
    project: d.project,
    instance: d.instance,
    skill,
    authorization: d.authorization
  });

  // Everyone with access to the group inherits it on the added skill, so adding a skill
  // must not hand out more than the consumer already holds on it.
  if (d.action == 'add' && skill.store) {
    let grantedLevel = await skillGroupService.getHighestGrantedAccessLevel({ skillGroup });

    if (grantedLevel == 'manage') {
      await skillStoreResource.assertAccess({
        project: d.project,
        store: skill.store,
        authorization: d.authorization,
        level: 'manage'
      });
    }
  }
};
