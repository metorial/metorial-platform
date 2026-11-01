import { slugify } from '@lowerdeck/slugify';
import type { Skill } from '@metorial/db';
import { parse, stringify } from 'yaml';

export let maxSkillNameLength = 64;

let frontmatterRegex = /^(?:\uFEFF)?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

type SkillFrontmatterSource = Pick<
  Skill,
  | 'name'
  | 'clientName'
  | 'description'
  | 'clientDescription'
  | 'license'
  | 'compatibility'
  | 'clientMetadata'
>;

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null));

export let parseSkillDocumentFrontmatter = (content: string) => {
  let match = content.match(frontmatterRegex);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };

  let parsed: unknown = {};
  try {
    parsed = parse(match[1] ?? '');
  } catch {}

  return {
    frontmatter: isRecord(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
};

let getSkillFrontmatterName = (skill: Pick<Skill, 'name' | 'clientName'>) =>
  slugify((skill.clientName ?? skill.name ?? 'unknown').replaceAll('_', '-'));

// Agent Skills names are at most 64 lowercase characters, with single hyphens only between words.
export let normalizeSkillAgentName = (value: string, maxLength = maxSkillNameLength) => {
  let name = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');

  return name || 'skill';
};

export let getSkillAgentName = (skill: Pick<Skill, 'name' | 'clientName'>) =>
  normalizeSkillAgentName(getSkillFrontmatterName(skill));

export let renderSkillDocumentFrontmatter = (
  content: string,
  d: { skill: SkillFrontmatterSource; name?: string }
) => {
  let {
    frontmatter: givenFrontmatter,
    body,
    hasFrontmatter
  } = parseSkillDocumentFrontmatter(content);

  let nextFrontmatter = Object.assign({}, givenFrontmatter, {
    name: d.name ?? getSkillFrontmatterName(d.skill),
    description:
      d.skill.clientDescription ||
      givenFrontmatter.description ||
      d.skill.description ||
      d.skill.name ||
      'Unknown Skill',
    license: d.skill.license || givenFrontmatter.license || undefined,
    compatibility: d.skill.compatibility || givenFrontmatter.compatibility || undefined,
    metadata: {
      ...(isRecord(d.skill.clientMetadata) ? d.skill.clientMetadata : {}),
      ...(isRecord(givenFrontmatter.metadata) ? givenFrontmatter.metadata : {})
    }
  });

  let separator = hasFrontmatter ? '\n' : '\n\n';
  // YAML 1.1 output quotes strings like "yes" or "2024-01-01", so hosts parsing with YAML 1.1
  // read the same values the listing reports.
  let yaml = stringify(stripUndefined(nextFrontmatter), { version: '1.1' }).trimEnd();
  return `---\n${yaml}\n---${separator}${body}`;
};
