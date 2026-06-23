import { AssistantOwner, db } from '../../db';
import { getId } from '../../id';
import type { Implementation } from './implementation';

export let assistant = async (d: {
  slug: string;
  name: string;
  systemIdentifier: string | undefined;
  implementation: Promise<Implementation>;
}) => {
  let implementation = await d.implementation;

  let _persisted = await db.assistant.upsert({
    where: {
      slug: d.slug
    },
    update: {
      name: d.name,
      systemIdentifier: d.systemIdentifier,
      implementationOid: implementation._persisted.oid
    },
    create: {
      ...getId('assistant'),
      ownerType: AssistantOwner.metorial,
      implementationOid: implementation._persisted.oid,
      name: d.name,
      slug: d.slug,
      systemIdentifier: d.systemIdentifier
    },
    include: {
      implementation: true
    }
  });

  return {
    _persisted,
    ...d,
    implementation
  };
};
