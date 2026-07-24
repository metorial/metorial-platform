import { ConsumerGroup, ConsumerProfile, Instance } from '@metorial/db';
import { skillService } from '@metorial/cargo-module-skill';
import { consumerSkillService } from '@metorial/module-consumer';
import { resolveResourceScopeForOwner } from '@metorial/module-resource-tenant';

export let assertConsumerCanWriteSkillGroupItem = async (d: {
  instance: Instance;
  skillId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let scope = await resolveResourceScopeForOwner({
    type: 'instance',
    instance: {
      id: d.instance.id
    }
  });

  let skill = await skillService.getSkillById({
    resourceTenant: scope.resourceTenant,
    resourceGroup: scope.resourceGroup,
    skillId: d.skillId,
    allowDeleted: true,
    consumerProfileOid: d.consumerProfile.oid
  });

  await consumerSkillService.assertConsumerCanWriteSkill({
    skill,
    consumerProfile: d.consumerProfile
  });
};
