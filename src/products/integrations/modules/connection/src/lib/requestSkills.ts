export let SKILLS_EXTENSION_ID = 'io.modelcontextprotocol/skills';
export let SKILL_URI_PREFIX = 'skill://';

export interface SkillSourceLimits {
  maxFiles: number;
  maxBytes: number;
}

export interface SkillSourceSkill {
  id: string;
  name: string;
}

export interface SkillSourceDocument {
  frontmatter: Record<string, unknown>;
  size: number;
}

export interface SkillSourceEntry {
  path: string;
  mimeType: string;
  size: number;
}

export interface SkillSourceFile extends SkillSourceEntry {
  sha256: string;
}

export interface SkillSourceFileContent {
  path: string;
  mimeType: string;
  size: number;
  text: string | null;
  bytes: Uint8Array;
}

// Skills belong to the calling consumer: resolved per request and never stored on the
// session, because hosted sessions are shared across callers. Each skill is served as an
// Agent Skills package whose SKILL.md frontmatter name matches `name`; the limits must be
// enforced from stored sizes before any file content is read.
export interface RequestScopedSkillSource {
  listSkills: () => Promise<SkillSourceSkill[]>;

  getSkillDocument: (d: {
    skillId: string;
    limits: SkillSourceLimits;
  }) => Promise<SkillSourceDocument | null>;

  listSkillFiles: (d: {
    skillId: string;
    limits: SkillSourceLimits;
  }) => Promise<{ frontmatter: Record<string, unknown>; files: SkillSourceFile[] } | null>;

  listSkillEntries: (d: {
    skillId: string;
    limits: SkillSourceLimits;
  }) => Promise<SkillSourceEntry[] | null>;

  readSkillFile: (d: {
    skillId: string;
    path: string;
    limits: SkillSourceLimits;
  }) => Promise<SkillSourceFileContent | null>;
}

export type RequestScopedSkillsResolver = () => Promise<RequestScopedSkillSource | null>;

export let isSkillResourceUri = (uri: string) => uri.startsWith(SKILL_URI_PREFIX);
