import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { slugify } from '@lowerdeck/slugify';
import { fileService } from '@metorial/module-file';
import type { Prisma } from '@metorial/db';
import { db } from '@metorial/db';
import PQueue from 'p-queue';
import { stringify } from 'yaml';
import { combineConfigs } from '../../lib/combineConfigs';
import { scriptsFolder } from '../../lib/files';
import { assertSkillStoreFileLimit } from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
import type { SkillSerializerInput } from '../_lib/types';
import { getPluginPath } from '../plugin';
import {
  getEffectiveAllowedFileExtensions,
  isAllowedBySkillConfig,
  isRootSkillDocument,
  normalizeSkillPath
} from './config';
import { parseSkillDocumentFrontmatter } from './frontmatter';

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

let sanitizeSkillDocumentFileNamePart = (part: string) =>
  part
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

let normalizeSkillDocumentPath = (path: string) => {
  let normalizedPath = normalizeSkillPath(path);
  let pathParts = normalizedPath.split('/');
  let fileName = pathParts.pop() ?? '';
  let dotIndex = fileName.lastIndexOf('.');
  let hasExtension = dotIndex > 0 && dotIndex < fileName.length - 1;
  let baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  let extension = hasExtension ? fileName.slice(dotIndex) : '.md';

  let sanitizedBaseName = sanitizeSkillDocumentFileNamePart(baseName) || 'document';
  let sanitizedExtension = sanitizeSkillDocumentFileNamePart(extension) || '.md';
  if (!sanitizedExtension.startsWith('.')) sanitizedExtension = `.${sanitizedExtension}`;

  return [...pathParts, `${sanitizedBaseName}${sanitizedExtension}`].join('/');
};

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null));

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
      input.skill.name ||
      'Unknown Skill',
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

export let applySkill = createApplicator(
  'skill',
  async input => {
    let skillStore = await db.store.findFirstOrThrow({
      where: { oid: input.skill.storeOid! }
    });
    await assertSkillStoreFileLimit({
      storeOid: skillStore.oid
    });

    let defaultConfig = await db.skillConfiguration.findFirst({
      where: {
        projectOid: input.skill.projectOid,
        instanceOid: input.skill.instanceOid,
        isDefault: true
      }
    });

    let config = combineConfigs(
      [
        input.skillPlugin.skillConfiguration,
        input.skillPluginSkill.skillConfiguration,
        input.skillMarketplacePlugin?.skillConfiguration,
        input.skillMarketplace?.skillConfiguration
      ],
      defaultConfig
    );

    let effectiveAllowedFileExtensions = getEffectiveAllowedFileExtensions(config);

    return {
      skillStore,
      config,
      effectiveAllowedFileExtensions
    };
  },
  {
    getHash: async (input, { skillStore, config, effectiveAllowedFileExtensions }) => {
      return await Hash.sha256(
        canonicalize({
          serializerVersion: 4,
          path: getSkillPath(input),
          skill: {
            name: input.skill.name,
            clientName: input.skill.clientName,
            description: input.skill.description,
            clientDescription: input.skill.clientDescription,
            license: input.skill.license,
            compatibility: input.skill.compatibility,
            clientMetadata: input.skill.clientMetadata
          },
          storeLastEditedAt: skillStore.lastEditedAt,
          config: {
            allowScripts: config.allowScripts,
            allowNonStandardDirectories: config.allowNonStandardDirectories,
            shouldFilterExtensions: effectiveAllowedFileExtensions.shouldFilter,
            allowedFileExtensions: [...effectiveAllowedFileExtensions.extensions].sort()
          }
        })
      );
    },

    apply: async (input, context, { skillStore, config }) => {
      context.setBasePath(getSkillPath(input));

      if (!config.allowScripts) {
        await context.deletePath(scriptsFolder);
      }

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
          if (item.path.startsWith('/agents/') || item.path.startsWith('agents/')) continue;

          if (item.kind === 'document' && item.document) {
            let documentPath = normalizeSkillDocumentPath(item.path);
            if (!isAllowedBySkillConfig(documentPath, config)) continue;

            let content = isRootSkillDocument(documentPath)
              ? applySkillDocumentFrontmatter(item.document.content.content, input)
              : item.document.content.content;

            await context.setFile(documentPath, content);
          } else if (item.kind === 'file' && item.file) {
            if (!isAllowedBySkillConfig(item.path, config)) continue;

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
    }
  }
);
