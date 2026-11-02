import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import PQueue from 'p-queue';
import {
  SKILL_URI_PREFIX,
  type RequestScopedSkillSource,
  type SkillSourceSkill
} from '../lib/requestSkills';

let skillsPerListPage = 20;
let skillConcurrency = 4;

let skillLimits = { maxFiles: 512, maxBytes: 16 * 1024 * 1024 };

let skillDocumentPath = '/SKILL.md';
let directoryMimeType = 'inode/directory';

let Sentry = getSentry();

export interface SkillMcpResource {
  uri: string;
  digest: string;
  size: number;
}

export interface SkillMcpEntry {
  uri: string;
  frontmatter: Record<string, unknown>;
  resources: SkillMcpResource[];
}

export interface SkillMcpDocument {
  uri: string;
  name: string;
  description?: string;
  size: number;
}

export type SkillMcpContent =
  | { uri: string; mimeType: string; text: string }
  | { uri: string; mimeType: string; blob: string };

export interface SkillMcpDirectoryEntry {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface SkillMcpCatalog {
  listSkills: (d: { cursor?: string }) => Promise<{
    skills: SkillMcpEntry[];
    nextCursor?: string;
  }>;

  listSkillDocuments: (d: { cursor?: string }) => Promise<{
    documents: SkillMcpDocument[];
    nextCursor?: string;
  }>;

  getSkill: (d: { uri: string }) => Promise<SkillMcpEntry | null>;

  readResource: (d: { uri: string }) => Promise<SkillMcpContent | null>;

  readDirectory: (d: {
    uri: string;
  }) => Promise<{ resources: SkillMcpDirectoryEntry[] } | null>;
}

let encodePath = (path: string) =>
  path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

let decodePath = (path: string) => {
  try {
    return path
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
};

export let toSkillUri = (skillName: string, path: string) =>
  `${SKILL_URI_PREFIX}${skillName}${path ? encodePath(path) : ''}`;

export let parseSkillUri = (uri: string) => {
  if (!uri.startsWith(SKILL_URI_PREFIX)) return null;

  let rest = uri.slice(SKILL_URI_PREFIX.length).replace(/\/+$/, '');
  let slashIndex = rest.indexOf('/');
  let skillName = slashIndex < 0 ? rest : rest.slice(0, slashIndex);
  let path = decodePath(slashIndex < 0 ? '' : rest.slice(slashIndex));
  if (!skillName || path === null) return null;

  return { skillName, path };
};

export let parseSkillCursor = (cursor: string | undefined) => {
  if (cursor === undefined) return 0;

  let offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ServiceError(badRequestError({ message: 'Invalid cursor' }));
  }

  return offset;
};

// One unreadable skill must not take the rest of the catalog down with it.
let skipFailedSkill = (skill: SkillSourceSkill) => (error: unknown) => {
  if (!isServiceError(error)) {
    Sentry.captureException(error, { extra: { skillId: skill.id } });
  }

  return null;
};

export let createSkillMcpCatalog = (source: RequestScopedSkillSource): SkillMcpCatalog => {
  let getSkills = async () =>
    (await source.listSkills()).sort((a, b) => a.name.localeCompare(b.name));

  let resolveUri = async (uri: string) => {
    let parsed = parseSkillUri(uri);
    if (!parsed) return null;

    let skill = (await getSkills()).find(entry => entry.name === parsed.skillName);
    if (!skill) return null;

    return { skill, path: parsed.path };
  };

  let getEntry = async (skill: SkillSourceSkill): Promise<SkillMcpEntry | null> => {
    let listed = await source.listSkillFiles({ skillId: skill.id, limits: skillLimits });
    if (!listed) return null;

    return {
      uri: toSkillUri(skill.name, skillDocumentPath),
      frontmatter: listed.frontmatter,
      resources: listed.files.map(file => ({
        uri: toSkillUri(skill.name, file.path),
        digest: `sha256:${file.sha256}`,
        size: file.size
      }))
    };
  };

  let getSkillDocument = async (skill: SkillSourceSkill): Promise<SkillMcpDocument | null> => {
    let document = await source.getSkillDocument({ skillId: skill.id, limits: skillLimits });
    if (!document) return null;

    let { name, description } = document.frontmatter;

    return {
      uri: toSkillUri(skill.name, skillDocumentPath),
      name: typeof name === 'string' ? name : skill.name,
      ...(typeof description === 'string' ? { description } : {}),
      size: document.size
    };
  };

  let listPage = async <T extends object>(
    cursor: string | undefined,
    load: (skill: SkillSourceSkill) => Promise<T | null>
  ) => {
    let offset = parseSkillCursor(cursor);
    let skills = await getSkills();
    let page = skills.slice(offset, offset + skillsPerListPage);

    let queue = new PQueue({ concurrency: skillConcurrency });
    let loaded: (T | null | undefined)[] = await Promise.all(
      page.map(skill => queue.add(() => load(skill).catch(skipFailedSkill(skill))))
    );

    let nextOffset = offset + page.length;

    return {
      items: loaded.filter((item): item is T => item != null),
      nextCursor: nextOffset < skills.length ? String(nextOffset) : undefined
    };
  };

  let listSkills: SkillMcpCatalog['listSkills'] = async input => {
    let { items, nextCursor } = await listPage(input.cursor, getEntry);

    return {
      skills: items,
      ...(nextCursor ? { nextCursor } : {})
    };
  };

  let listSkillDocuments: SkillMcpCatalog['listSkillDocuments'] = async input => {
    let { items, nextCursor } = await listPage(input.cursor, getSkillDocument);

    return { documents: items, ...(nextCursor ? { nextCursor } : {}) };
  };

  let getSkill: SkillMcpCatalog['getSkill'] = async input => {
    let resolved = await resolveUri(input.uri);
    if (!resolved || resolved.path !== skillDocumentPath) return null;

    return await getEntry(resolved.skill);
  };

  let readResource: SkillMcpCatalog['readResource'] = async input => {
    let resolved = await resolveUri(input.uri);
    if (!resolved) return null;

    let file = await source.readSkillFile({
      skillId: resolved.skill.id,
      path: resolved.path,
      limits: skillLimits
    });
    if (!file) return null;

    let uri = toSkillUri(resolved.skill.name, file.path);
    let isLosslessText =
      file.text !== null && new TextEncoder().encode(file.text).byteLength === file.size;

    return isLosslessText
      ? { uri, mimeType: file.mimeType, text: file.text! }
      : { uri, mimeType: file.mimeType, blob: Buffer.from(file.bytes).toString('base64') };
  };

  let readDirectory: SkillMcpCatalog['readDirectory'] = async input => {
    let resolved = await resolveUri(input.uri);
    if (!resolved) return null;

    let entries = await source.listSkillEntries({
      skillId: resolved.skill.id,
      limits: skillLimits
    });
    if (!entries) return null;

    let prefix = `${resolved.path.replace(/\/+$/, '')}/`;
    let containedFiles = entries.filter(file => file.path.startsWith(prefix));
    if (!containedFiles.length) return null;

    let skillName = resolved.skill.name;
    let directories = new Set<string>();
    let resources: SkillMcpDirectoryEntry[] = [];

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
