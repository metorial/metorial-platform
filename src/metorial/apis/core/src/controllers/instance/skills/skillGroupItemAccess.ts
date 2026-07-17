import { ConsumerGroup, ConsumerProfile, db, Instance } from '@metorial/db';
import { skillService } from '@metorial/cargo-module-skill';
import { consumerSkillService } from '@metorial/module-consumer';

export let assertConsumerCanWriteSkillGroupItem = async (d: {
  instance: Instance;
  skillId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let instance = await db.instance.findUniqueOrThrow({
    where: { id: d.instance.id },
    include: { resourceTenant: true, resourceGroup: true }
  });
  if (!instance.resourceTenant || !instance.resourceGroup) {
    throw new Error('Instance has no Cargo resource scope');
  }
  let skill = await skillService.getSkillById({
    resourceTenant: instance.resourceTenant,
    resourceGroup: instance.resourceGroup,
    skillId: d.skillId,
    allowDeleted: true,
    consumerProfileOid: d.consumerProfile.oid
  });

  await consumerSkillService.assertConsumerCanWriteSkill({
    skill,
    consumerProfile: d.consumerProfile
  });
};
