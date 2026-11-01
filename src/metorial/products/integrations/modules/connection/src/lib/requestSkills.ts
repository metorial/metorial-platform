export let SKILLS_EXTENSION_ID = 'io.modelcontextprotocol/skills';
export let SKILL_URI_PREFIX = 'skill://';

export interface RequestScopedSkillResource {
  uri: string;
  digest: string;
  size: number;
}

export interface RequestScopedSkill {
  uri: string;
  frontmatter: Record<string, unknown>;
  resources: RequestScopedSkillResource[];
}

export interface RequestScopedSkillDocument {
  uri: string;
  name: string;
  description?: string;
  size: number;
}

export type RequestScopedSkillContent =
  | { uri: string; mimeType: string; text: string }
  | { uri: string; mimeType: string; blob: string };

export interface RequestScopedSkillDirectoryEntry {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

// Skills belong to the calling consumer: resolved per request and never stored on the
// session, because hosted sessions are shared across callers.
export interface RequestScopedSkills {
  listSkills: (d: { cursor?: string }) => Promise<{
    skills: RequestScopedSkill[];
    nextCursor?: string;
  }>;

  listSkillDocuments: (d: { cursor?: string }) => Promise<{
    documents: RequestScopedSkillDocument[];
    nextCursor?: string;
  }>;

  getSkill: (d: { uri: string }) => Promise<RequestScopedSkill | null>;

  readResource: (d: { uri: string }) => Promise<RequestScopedSkillContent | null>;

  readDirectory: (d: {
    uri: string;
  }) => Promise<{ resources: RequestScopedSkillDirectoryEntry[] } | null>;
}

export type RequestScopedSkillsResolver = () => Promise<RequestScopedSkills | null>;

export let isSkillResourceUri = (uri: string) => uri.startsWith(SKILL_URI_PREFIX);
