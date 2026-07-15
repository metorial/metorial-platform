import { ConsumerGroup, ConsumerProfile, db, Instance } from '@metorial/db';
import { intersectIds } from './skill';

export let getConsumerSkillGroupAccessWhere = (
  consumerGroups: Pick<ConsumerGroup, 'oid'>[]
) => ({
  consumerAccesses: {
    some: {
      consumerGroupOid: {
        in: consumerGroups.map(group => group.oid)
      }
    }
  }
});

export let getAccessibleSkillGroupIds = async (d: {
  instance: Instance;
  consumerProfile: ConsumerProfile;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  requestedIds?: string[];
}) => {
  let skillGroups = await db.skillGroup.findMany({
    where: {
      instanceOid: d.instance.oid,
      ...getConsumerSkillGroupAccessWhere(d.consumerGroups)
    },
    select: {
      id: true
    }
  });

  return intersectIds(
    skillGroups.map(skillGroup => skillGroup.id),
    d.requestedIds
  );
};

export let assertSkillGroupReadable = async (d: {
  instance: Instance;
  skillGroupId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let skillGroup = await db.skillGroup.findFirst({
    where: {
      instanceOid: d.instance.oid,
      id: d.skillGroupId,
      ...getConsumerSkillGroupAccessWhere(d.consumerGroups ?? [])
    }
  });

  if (!skillGroup) throw new Error('Skill group not found');
};
