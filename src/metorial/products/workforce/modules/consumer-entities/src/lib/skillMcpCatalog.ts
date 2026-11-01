import { isServiceError } from '@lowerdeck/error';
import { once } from '@lowerdeck/once';
import { getSentry } from '@lowerdeck/sentry';
import type {
  RequestScopedSkill,
  RequestScopedSkillContent,
  RequestScopedSkillDirectoryEntry,
  RequestScopedSkillDocument,
  RequestScopedSkills
} from '@metorial-subspace/module-connection';
import { db } from '@metorial/db';
import {
  skillFileService,
  skillService,
  type SkillSnapshotFile,
  type SkillSnapshotOptions
} from '@metorial/module-skill';
import {
  getSkillAgentName,
  normalizeSkillAgentName,
  parseSkillDocumentFrontmatter,
  renderSkillDocumentFrontmatter
} from '@metorial/module-skill/frontmatter';
import PQueue from 'p-queue';
import {
  createConsumerSkillAccess,
  type ConsumerSkillAccessInput
} from './consumerSkillAccess';
import {
  assignSkillNames,
  isExcludedSkillPath,
  parseSkillCursor,
  parseSkillUri,
  toSkillUri,
  type CatalogSkill
} from './skillMcpNames';

let maxCatalogSkills = 1000;
let catalogPageSize = 100;
let skillsPerListPage = 20;
let skillConcurrency = 4;

let skillLimits = { maxFiles: 512, maxBytes: 16 * 1024 * 1024 };

let skillDocumentPath = '/SKILL.md';
let directoryMimeType = 'inode/directory';

let Sentry = getSentry();

type SkillManifest = {
  entry: RequestScopedSkill;
  files: SkillSnapshotFile[];
};

// One unreadable skill must not take the rest of the catalog down with it.
let skipFailedSkill = (catalogSkill: CatalogSkill) => (error: unknown) => {
  if (!isServiceError(error)) {
    Sentry.captureException(error, { extra: { skillId: catalogSkill.id } });
  }

  return null;
};

export let createSkillMcpCatalog = async (
  d: ConsumerSkillAccessInput
): Promise<RequestScopedSkills | null> => {
  let skillAccess = await createConsumerSkillAccess(d);
  if (!skillAccess) return null;

  let { getAccess } = skillAccess;

  let getCatalog = once(async () => {
    let access = await getAccess();
    if (access.allowedSkillIds?.size === 0) return [];

    let paginator = await skillService.listSkills({
      ...access.scope,
      ids: access.allowedSkillIds ? [...access.allowedSkillIds] : undefined,
      accessTags: access.accessTags
    });

    let skillIds: string[] = [];
    let after: string | undefined;

    while (skillIds.length < maxCatalogSkills) {
      let list = await paginator.run({ limit: catalogPageSize, ...(after ? { after } : {}) });
      skillIds.push(...list.items.map(item => item.id));

      if (!list.pagination.hasNextPage || list.items.length === 0) break;
      after = list.items[list.items.length - 1]!.id;
    }

    let records = await db.skill.findMany({
      where: { id: { in: skillIds }, status: 'active', storeOid: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        clientName: true,
        skillPluginSkills: d.skillPluginOid
          ? {
              where: { skillPluginOid: d.skillPluginOid, status: 'active' },
              select: { pluginSkillSlug: true },
              take: 1
            }
          : false
      }
    });

    let named = records.map(record => {
      let pluginSkillSlug = record.skillPluginSkills?.[0]?.pluginSkillSlug;

      return {
        id: record.id,
        slug: record.slug,
        baseName: pluginSkillSlug
          ? normalizeSkillAgentName(pluginSkillSlug)
          : getSkillAgentName(record)
      };
    });

    return assignSkillNames(named).sort((a, b) => a.name.localeCompare(b.name));
  });

  let resolveCatalogUri = async (uri: string) => {
    let parsed = parseSkillUri(uri);
    if (!parsed) return null;

    let catalogSkill = (await getCatalog()).find(skill => skill.name === parsed.skillName);
    if (!catalogSkill) return null;

    return { catalogSkill, path: parsed.path };
  };

  let loadSkill = async (catalogSkill: CatalogSkill) => {
    let access = await getAccess();

    let skill = await skillService.getSkillById({
      ...access.scope,
      skillId: catalogSkill.id,
      accessTags: access.accessTags
    });

    let scope = { ...access.scope, skill, authorization: access.authorization };

    let options: SkillSnapshotOptions = {
      includePath: path => !isExcludedSkillPath(path),
      limits: skillLimits,
      transformDocument: file =>
        file.path === skillDocumentPath
          ? renderSkillDocumentFrontmatter(file.content, { skill, name: catalogSkill.name })
          : file.content
    };

    return {
      list: () => skillFileService.listSkillSnapshotFiles({ ...scope, options }),
      read: (path: string) =>
        skillFileService.readSkillSnapshotFile({ ...scope, path, options })
    };
  };

  let getManifest = async (catalogSkill: CatalogSkill): Promise<SkillManifest | null> => {
    let files = await (await loadSkill(catalogSkill)).list();
    let skillDocument = files?.find(file => file.path === skillDocumentPath);
    if (!files || skillDocument?.text == null) return null;

    return {
      entry: {
        uri: toSkillUri(catalogSkill.name, skillDocumentPath),
        frontmatter: parseSkillDocumentFrontmatter(skillDocument.text).frontmatter,
        resources: files.map(file => ({
          uri: toSkillUri(catalogSkill.name, file.path),
          digest: `sha256:${file.sha256}`,
          size: file.size
        }))
      },
      files
    };
  };

  let getSkillDocument = async (
    catalogSkill: CatalogSkill
  ): Promise<RequestScopedSkillDocument | null> => {
    let file = await (await loadSkill(catalogSkill)).read(skillDocumentPath);
    if (file?.text == null) return null;

    let { name, description } = parseSkillDocumentFrontmatter(file.text).frontmatter;

    return {
      uri: toSkillUri(catalogSkill.name, skillDocumentPath),
      name: typeof name === 'string' ? name : catalogSkill.name,
      ...(typeof description === 'string' ? { description } : {}),
      size: file.size
    };
  };

  let listPage = async <T extends object>(
    cursor: string | undefined,
    load: (catalogSkill: CatalogSkill) => Promise<T | null>
  ) => {
    let offset = parseSkillCursor(cursor);
    let catalog = await getCatalog();
    let page = catalog.slice(offset, offset + skillsPerListPage);

    let queue = new PQueue({ concurrency: skillConcurrency });
    let loaded: (T | null | undefined)[] = await Promise.all(
      page.map(catalogSkill =>
        queue.add(() => load(catalogSkill).catch(skipFailedSkill(catalogSkill)))
      )
    );

    let nextOffset = offset + page.length;

    return {
      items: loaded.filter((item): item is T => item != null),
      nextCursor: nextOffset < catalog.length ? String(nextOffset) : undefined
    };
  };

  let listSkills: RequestScopedSkills['listSkills'] = async input => {
    let { items, nextCursor } = await listPage(input.cursor, getManifest);

    return {
      skills: items.map(manifest => manifest.entry),
      ...(nextCursor ? { nextCursor } : {})
    };
  };

  let listSkillDocuments: RequestScopedSkills['listSkillDocuments'] = async input => {
    let { items, nextCursor } = await listPage(input.cursor, getSkillDocument);

    return { documents: items, ...(nextCursor ? { nextCursor } : {}) };
  };

  let getSkill: RequestScopedSkills['getSkill'] = async input => {
    let resolved = await resolveCatalogUri(input.uri);
    if (!resolved || resolved.path !== skillDocumentPath) return null;

    return (await getManifest(resolved.catalogSkill))?.entry ?? null;
  };

  let readResource: RequestScopedSkills['readResource'] = async input => {
    let resolved = await resolveCatalogUri(input.uri);
    if (!resolved) return null;

    let file = await (await loadSkill(resolved.catalogSkill)).read(resolved.path);
    if (!file) return null;

    let uri = toSkillUri(resolved.catalogSkill.name, file.path);
    let isLosslessText =
      file.text !== null && new TextEncoder().encode(file.text).byteLength === file.size;

    return (
      isLosslessText
        ? { uri, mimeType: file.mimeType, text: file.text! }
        : { uri, mimeType: file.mimeType, blob: Buffer.from(file.bytes).toString('base64') }
    ) satisfies RequestScopedSkillContent;
  };

  let readDirectory: RequestScopedSkills['readDirectory'] = async input => {
    let resolved = await resolveCatalogUri(input.uri);
    if (!resolved) return null;

    let manifest = await getManifest(resolved.catalogSkill);
    if (!manifest) return null;

    let prefix = `${resolved.path.replace(/\/+$/, '')}/`;
    let containedFiles = manifest.files.filter(file => file.path.startsWith(prefix));
    if (!containedFiles.length) return null;

    let skillName = resolved.catalogSkill.name;
    let directories = new Set<string>();
    let resources: RequestScopedSkillDirectoryEntry[] = [];

    for (let file of containedFiles) {
      let [childName, ...rest] = file.path.slice(prefix.length).split('/');
      if (!childName) continue;

      if (rest.length) {
        if (directories.has(childName)) continue;
        directories.add(childName);

        resources.push({
          uri: toSkillUri(skillName, `${prefix}${childName}`),
          name: childName,
          mimeType: directoryMimeType
        });
        continue;
      }

      resources.push({
        uri: toSkillUri(skillName, file.path),
        name: childName,
        mimeType: file.mimeType,
        size: file.size
      });
    }

    return { resources };
  };

  return { listSkills, listSkillDocuments, getSkill, readResource, readDirectory };
};
