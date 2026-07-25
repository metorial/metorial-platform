import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { ConsumerProfile, Instance } from '@metorial/db';
import { skillGroupService, skillService } from '@metorial/cargo-module-skill';
import type { AnyAccessTagSelector, ResourceAuthorization } from '@metorial/module-access';
import type { ResourceScope } from '@metorial/module-resource-tenant';

export let assertConsumerCanWriteSkillGroupItem = async (
  d: ResourceScope & {
    instance: Instance;
    skillGroupId: string;
    skillId: string;
    consumerProfile?: ConsumerProfile;
    accessTags?: AnyAccessTagSelector;
    authorization: ResourceAuthorization;
  }
) => {
  if (!d.consumerProfile) return;

  let [skillGroup, skill] = await Promise.all([
    skillGroupService.getSkillGroupById({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
      skillGroupId: d.skillGroupId,
      accessTags: d.accessTags
    }),
    skillService.getSkillById({
      resourceTenant: d.resourceTenant,
      resourceGroup: d.resourceGroup,
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
    resourceTenant: d.resourceTenant,
    resourceGroup: d.resourceGroup,
    skill,
    authorization: d.authorization
  });
};
