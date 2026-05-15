import { Hash } from '@lowerdeck/hash';
import type { Prisma } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import { fileService } from '@metorial-cargo/module-file';
import PQueue from 'p-queue';
import { createApplicator } from '../_lib/apply';
import type { SkillSerializerInput } from '../_lib/types';
import { getPluginPath } from '../plugin';

export let getSkillPath = (d: SkillSerializerInput) => {
  let inner = `skills/${d.skillPluginSkill.pluginSkillSlug}`;

  let pluginPath = getPluginPath(d);
  if (pluginPath) return `${pluginPath}/${inner}`;

  return inner;
};

let storeItemInclude = {
  document: {
    include: {
      content: true
    }
  },
  file: true
} satisfies Prisma.StoreItemInclude;

export let applySkill = createApplicator('skill', async (input, context) => {
  let skillStore = await db.store.findFirstOrThrow({
    where: { oid: input.skill.storeOid }
  });

  let hash = await Hash.sha256(
    [
      1,
      input.skill.oid,
      input.skillPlugin.oid,
      input.skill.updatedAt.getTime(),
      skillStore.lastEditedAt.getTime()
    ].join(':')
  );
  if (context.hashIsEqual(hash)) return;
  context.setHash?.(hash);

  context.setBasePath(getSkillPath(input));

  let q = new PQueue({ concurrency: 10 });
  let cursor: string | null = null;
  let limit = 25;

  while (true) {
    let items = await db.storeItem.findMany({
      where: {
        storeOid: skillStore.oid,
        kind: { in: ['document', 'file'] },
        id: cursor ? { gt: cursor } : undefined
      },
      include: storeItemInclude,
      orderBy: {
        id: 'asc'
      },
      take: limit
    });

    for (let item of items) {
      if (item.kind === 'document' && item.document) {
        await context.setFile(item.path, item.document.content.content);
      } else if (item.kind === 'file' && item.file) {
        q.add(async () => {
          let content = await fileService.downloadFileContent({
            file: item.file!
          });

          await context.setFile(item.path, content);
        });
      }
    }

    if (items.length < limit) break;
    cursor = items[items.length - 1]!.id as string;
  }

  await q.onIdle();
});
