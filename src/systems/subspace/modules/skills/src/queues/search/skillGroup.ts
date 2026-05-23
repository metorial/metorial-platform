import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexSkillGroupQueue = createQueue<{ skillGroupId: string }>({
  name: 'sub/sk/sidx/skillGroup',
  redisUrl: env.service.REDIS_URL
});

export let indexSkillGroupRecord = async (d: { skillGroupId: string }) => {
  let skillGroup = await db.skillGroup.findUnique({
    where: { id: d.skillGroupId },
    include: {
      tenant: true,
      skillGroupItems: {
        where: { status: 'active' },
        include: {
          skill: true
        }
      }
    }
  });
  if (!skillGroup) throw new QueueRetryError();

  if (skillGroup.status !== 'active' || (!skillGroup.name && !skillGroup.description)) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillGroup.id,
      documentIds: [skillGroup.id]
    });
    return;
  }

  let skills = skillGroup.skillGroupItems
    .map(item => item.skill)
    .filter(skill => skill.status === 'active');

  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skillGroup.id,
    documentId: skillGroup.id,
    tenantIds: [skillGroup.tenant.id],
    fields: {
      skillGroupId: skillGroup.id,
      skillIds: skills.map(skill => skill.id)
    },
    body: {
      name: skillGroup.name,
      description: skillGroup.description,
      skillNames: skills.map(skill => skill.name),
      skillDescriptions: skills.map(skill => skill.description).filter(Boolean),
      skillClientNames: skills.map(skill => skill.clientName),
      skillClientDescriptions: skills.map(skill => skill.clientDescription).filter(Boolean)
    }
  });
};

export let indexSkillGroupQueueProcessor = indexSkillGroupQueue.process(async data => {
  await indexSkillGroupRecord(data);
});
