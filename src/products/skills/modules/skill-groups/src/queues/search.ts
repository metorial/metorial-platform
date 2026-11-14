import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getProjectTenantIdentifier } from '@metorial/skills-common';

export let indexSkillGroupQueue = createQueue<{ skillGroupId: string }>({
  name: 'cargo/skill/search/skillGroup',
  workerOpts: { concurrency: 10 }
});

export let indexSkillGroupQueueProcessor = indexSkillGroupQueue.process(async data => {
  let group = await db.skillGroup.findUnique({
    where: { id: data.skillGroupId },
    include: {
      instance: true,
      items: {
        where: { status: 'active', skill: { status: 'active' } },
        include: { skill: true }
      }
    }
  });
  if (!group) throw new QueueRetryError();

  if (group.status !== 'active' || (!group.name && !group.description)) {
    await voyager.record.delete({
      sourceId: (await voyagerSource).id,
      indexId: voyagerIndex.skillGroup.id,
      documentIds: [group.id]
    });
    return;
  }

  let skills = group.items.map(item => item.skill);
  await voyager.record.index({
    sourceId: (await voyagerSource).id,
    indexId: voyagerIndex.skillGroup.id,
    documentId: group.id,
    tenantIds: [getProjectTenantIdentifier({ oid: group.instance.projectOid })],
    fields: {
      skillGroupId: group.id,
      skillIds: skills.map(skill => skill.id)
    },
    body: {
      name: group.name,
      description: group.description,
      skillNames: skills.map(skill => skill.name),
      skillDescriptions: skills.map(skill => skill.description).filter(Boolean),
      skillClientNames: skills.map(skill => skill.clientName),
      skillClientDescriptions: skills.map(skill => skill.clientDescription).filter(Boolean)
    }
  });
});
