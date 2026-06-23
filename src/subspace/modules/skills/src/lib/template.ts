import { db, getId } from '@metorial-subspace/db';
import { cargo } from '../cargo';
import {
  skillTemplateCreatedQueue,
  skillTemplateUpdatedQueue
} from '../queues/lifecycle/skillTemplate';

export let template = async (d: {
  identifier: string;
  name: string;
  description: string;
  items: (
    | {
        path: string;
        type: 'file' | 'document';
        content: string;
        encoding: 'utf-8' | 'base64';
      }
    | {
        path: string;
        type: 'directory';
      }
  )[];
}) => {
  let newId = getId('skillTemplate');
  let existing = await db.skillTemplate.findUnique({
    where: { systemIdentifier: d.identifier },
    select: { id: true }
  });

  let cargoTemplate = await cargo.skillTemplate.upsert({
    systemIdentifier: d.identifier,
    skillTemplateId: newId.id,
    name: d.name,
    items: d.items
  });

  let inner = {
    systemIdentifier: d.identifier,
    slug: d.identifier,
    name: d.name,
    description: d.description,
    storeTemplateId: cargoTemplate.storeTemplate.id,
    status: 'active' as const,
    owner: 'system' as const
  };

  let skillTemplate = await db.skillTemplate.upsert({
    where: { systemIdentifier: d.identifier },
    create: {
      ...newId,
      ...inner
    },
    update: inner
  });

  await (existing ? skillTemplateUpdatedQueue : skillTemplateCreatedQueue).add({
    skillTemplateId: skillTemplate.id
  });

  return skillTemplate;
};
