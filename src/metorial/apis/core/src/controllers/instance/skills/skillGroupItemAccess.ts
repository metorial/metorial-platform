import { ConsumerGroup, ConsumerProfile, Instance } from '@metorial/db';
import { consumerSkillService } from '@metorial/module-consumer';
import { subspaceSkillService } from '@metorial/module-subspace';

export let assertConsumerCanWriteSkillGroupItem = async (d: {
  instance: Instance;
  skillId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let skill = await subspaceSkillService.get({
    instance: d.instance,
    skillId: d.skillId,
    allowDeleted: true,
    consumerProfile: d.consumerProfile,
    consumerGroups: d.consumerGroups ?? []
  });

  await consumerSkillService.assertConsumerCanWriteSkill({
    skill: skill.localSkill,
    consumerProfile: d.consumerProfile
  });
};
