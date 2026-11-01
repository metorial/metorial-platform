import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  maxSkillNameLength,
  normalizeSkillAgentName
} from '@metorial/module-skill/frontmatter';

let skillUriPrefix = 'skill://';
let collisionSuffixLength = 5;
let maxSuffixLength = 24;

export type CatalogSkill = {
  id: string;
  name: string;
};

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
  `${skillUriPrefix}${skillName}${path ? encodePath(path) : ''}`;

export let parseSkillUri = (uri: string) => {
  if (!uri.startsWith(skillUriPrefix)) return null;

  let rest = uri.slice(skillUriPrefix.length).replace(/\/+$/, '');
  let slashIndex = rest.indexOf('/');
  let skillName = slashIndex < 0 ? rest : rest.slice(0, slashIndex);
  let path = decodePath(slashIndex < 0 ? '' : rest.slice(slashIndex));
  if (!skillName || path === null) return null;

  return { skillName, path };
};

export let isExcludedSkillPath = (path: string) => path.startsWith('/agents/');

export let parseSkillCursor = (cursor: string | undefined) => {
  if (cursor === undefined) return 0;

  let offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ServiceError(badRequestError({ message: 'Invalid cursor' }));
  }

  return offset;
};

let toSuffixSource = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// The slug ends in a short random part; the id is unique, so growing it always resolves a clash.
let getSuffixCandidates = (skill: { id: string; slug: string | null }) => {
  let slug = toSuffixSource(skill.slug ?? '');
  let id = toSuffixSource(skill.id);

  let idSuffixes = Array.from(
    { length: Math.max(0, Math.min(id.length, maxSuffixLength) - collisionSuffixLength + 1) },
    (_, index) => id.slice(-(collisionSuffixLength + index))
  );

  return [...(slug ? [slug.slice(-collisionSuffixLength)] : []), ...idSuffixes];
};

let withSuffix = (baseName: string, suffix: string) =>
  `${normalizeSkillAgentName(baseName, maxSkillNameLength - 1 - suffix.length)}-${suffix}`;

// Skills arrive oldest first: the oldest keeps its base name so existing URIs stay stable, and
// every later collision gets the shortest unique suffix taken from its own slug and id.
export let assignSkillNames = (
  skills: { id: string; slug: string | null; baseName: string }[]
): CatalogSkill[] => {
  let baseNames = new Set(skills.map(skill => skill.baseName));
  let taken = new Set<string>();

  let isFree = (name: string, baseName: string) =>
    !taken.has(name) && (name === baseName || !baseNames.has(name));

  return skills.map(skill => {
    let name = skill.baseName;

    if (!isFree(name, skill.baseName)) {
      let candidates = getSuffixCandidates(skill).map(suffix =>
        withSuffix(skill.baseName, suffix)
      );

      name =
        candidates.find(candidate => isFree(candidate, skill.baseName)) ??
        withSuffix(skill.baseName, `${toSuffixSource(skill.id).slice(-8)}${taken.size}`);
    }

    taken.add(name);
    return { id: skill.id, name };
  });
};
