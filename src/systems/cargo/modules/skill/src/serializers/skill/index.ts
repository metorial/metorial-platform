import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import type { Prisma } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import { fileService } from '@metorial-cargo/module-file';
import PQueue from 'p-queue';
import { parse, stringify } from 'yaml';
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

let frontmatterRegex = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

let isRootSkillDocument = (path: string) => path.replace(/^\/+/, '') === 'SKILL.md';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null));

let parseSkillDocumentFrontmatter = (content: string) => {
  let match = content.match(frontmatterRegex);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };

  let parsed = parse(match[1] ?? '');

  return {
    frontmatter: isRecord(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
};

let applySkillDocumentFrontmatter = (content: string, input: SkillSerializerInput) => {
  let {
    frontmatter: givenFrontmatter,
    body,
    hasFrontmatter
  } = parseSkillDocumentFrontmatter(content);

  let nextFrontmatter = Object.assign({}, givenFrontmatter, {
    name: slugify(
      (input.skill.clientName ?? input.skill.name ?? 'unknown').replaceAll('_', '-')
    ),
    description:
      input.skill.clientDescription ||
      givenFrontmatter.description ||
      input.skill.description ||
      undefined,
    license: input.skill.license || givenFrontmatter.license || undefined,
    compatibility: input.skill.compatibility || givenFrontmatter.compatibility || undefined,
    metadata: {
      ...(isRecord(input.skill.clientMetadata) ? input.skill.clientMetadata : {}),
      ...(isRecord(givenFrontmatter.metadata) ? givenFrontmatter.metadata : {})
    }
  });

  let separator = hasFrontmatter ? '\n' : '\n\n';
  return `---\n${stringify(stripUndefined(nextFrontmatter)).trimEnd()}\n---${separator}${body}`;
};

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
      if (item.path.startsWith('/agents/') || item.path.startsWith('/agents/')) continue;

      if (item.kind === 'document' && item.document) {
        let content = isRootSkillDocument(item.path)
          ? applySkillDocumentFrontmatter(item.document.content.content, input)
          : item.document.content.content;

        await context.setFile(item.path, content);
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
