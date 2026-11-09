import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { fileService } from '@metorial/module-file';
import type { Prisma, Skill, SkillConfiguration, Store } from '@metorial/db';
import { db } from '@metorial/db';
import { renderSkillDocumentFrontmatter } from '@metorial/module-skill/frontmatter';
import PQueue from 'p-queue';
import { combineConfigs } from '../../lib/combineConfigs';
import {
  assertSkillStoreByteLimit,
  assertSkillStoreFileLimit,
  checkSkillStoreByteSize,
  checkSkillStoreFileCount,
  getSkillStoreSizes
} from '../../lib/limits';
import { createApplicator } from '../_lib/apply';
import type { SerializerInputByType } from '../_lib/types';
import { getMarketplaceForceSyncHashInput } from '../_lib/forceSync';
import { getSkillPath, getSkillPruneScope } from '../_lib/paths';
import {
  getEffectiveAllowedFileExtensions,
  isAllowedBySkillConfig,
  isRootSkillDocument,
  normalizeSkillPath
} from './config';

export { getSkillPath };

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

type SkillInput = SerializerInputByType<'skill'>;

let lookupPageSize = 100;

let resolveSkillInit = (
  input: SkillInput,
  skillStore: Store,
  defaultConfig: SkillConfiguration | null
) => {
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
};

let getDefaultConfigKey = (skill: Pick<Skill, 'projectOid' | 'instanceOid'>) =>
  `${skill.projectOid}:${skill.instanceOid}`;

export type SkillInitLookup = {
  stores: Map<bigint, Store>;
  storeSizes: Map<bigint, { files: number; bytes: bigint }>;
  defaultConfigs: Map<string, SkillConfiguration>;
};

// Batched equivalent of the per-skill init queries, so collecting a large destination doesn't
// issue several queries per skill. `initSkillFromLookup` must yield the same hash inputs.
export let loadSkillInitLookup = async (
  skills: Pick<Skill, 'storeOid' | 'projectOid' | 'instanceOid'>[]
): Promise<SkillInitLookup> => {
  let storeOids = [
    ...new Set(skills.flatMap(skill => (skill.storeOid ? [skill.storeOid] : [])))
  ];
  let stores = new Map<bigint, Store>();

  for (let i = 0; i < storeOids.length; i += lookupPageSize) {
    let page = await db.store.findMany({
      where: { oid: { in: storeOids.slice(i, i + lookupPageSize) } }
    });
    for (let store of page) stores.set(store.oid, store);
  }

  let scopes = [
    ...new Map(skills.map(skill => [getDefaultConfigKey(skill), skill] as const)).values()
  ];
  let defaultConfigs = new Map<string, SkillConfiguration>();

  for (let i = 0; i < scopes.length; i += lookupPageSize) {
    let configs = await db.skillConfiguration.findMany({
      where: {
        isDefault: true,
        OR: scopes.slice(i, i + lookupPageSize).map(skill => ({
          projectOid: skill.projectOid,
          instanceOid: skill.instanceOid
        }))
      },
      orderBy: { oid: 'asc' }
    });

    for (let config of configs) {
      let key = getDefaultConfigKey(config);
      if (!defaultConfigs.has(key)) defaultConfigs.set(key, config);
    }
  }

  return {
    stores,
    storeSizes: await getSkillStoreSizes(storeOids),
    defaultConfigs
  };
};

export let getSkillInitLookupSize = (
  lookup: SkillInitLookup,
  skills: Pick<Skill, 'storeOid'>[]
) => {
  let files = 0;
  let bytes = 0n;

  for (let skill of skills) {
    let size = skill.storeOid ? lookup.storeSizes.get(skill.storeOid) : undefined;
    files += size?.files ?? 0;
    bytes += size?.bytes ?? 0n;
  }

  return { files, bytes };
};

export let initSkillFromLookup = async (input: SkillInput, lookup: SkillInitLookup) => {
  let skillStore = lookup.stores.get(input.skill.storeOid!);
  let storeSize = lookup.storeSizes.get(input.skill.storeOid!);
  if (!skillStore || !storeSize) {
    throw new Error(`Store ${input.skill.storeOid} of skill ${input.skill.id} not found`);
  }

  checkSkillStoreFileCount({ currentCount: storeSize.files });
  await checkSkillStoreByteSize({
    currentBytes: storeSize.bytes,
    instanceOid: skillStore.instanceOid
  });

  return resolveSkillInit(
    input,
    skillStore,
    lookup.defaultConfigs.get(getDefaultConfigKey(input.skill)) ?? null
  );
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
    await assertSkillStoreByteLimit({
      storeOid: skillStore.oid,
      instanceOid: skillStore.instanceOid
    });

    let defaultConfig = await db.skillConfiguration.findFirst({
      where: {
        projectOid: input.skill.projectOid,
        instanceOid: input.skill.instanceOid,
        isDefault: true
      }
    });

    return resolveSkillInit(input, skillStore, defaultConfig);
  },
  {
    getPruneScope: getSkillPruneScope,

    getHash: async (input, { skillStore, config, effectiveAllowedFileExtensions }) => {
      return await Hash.sha256(
        canonicalize({
          serializerVersion: 4,
          ...getMarketplaceForceSyncHashInput(input.skillMarketplace),
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
              ? renderSkillDocumentFrontmatter(item.document.content.content, input)
              : item.document.content.content;

            await context.setFile(documentPath, content);
          } else if (item.kind === 'file' && item.file) {
            if (!isAllowedBySkillConfig(item.path, config)) continue;

            q.add(async () => await context.setFileFromStorage(item.path, item.file!));
          }
        }

        if (items.length < limit) break;
        cursor = items[items.length - 1]!.id as string;
      }

      await q.onIdle();
    }
  }
);
