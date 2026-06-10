import { posix as path } from 'node:path';
import type { FsProvider } from '../providers/types';

// ── Types ─────────────────────────────────────────────────────────────

export interface SkillInfo {
  /** Unique skill identifier (lowercase, hyphenated). */
  name: string;
  /** Short description of what the skill does. */
  description: string;
  /** Absolute path to the SKILL.md file. */
  location: string;
  /** Markdown body (after frontmatter). */
  content: string;
}

export interface SkillsConfig {
  /**
   * Directories to scan for `** /SKILL.md` files.
   * Supports absolute paths, relative paths resolved by the provided filesystem
   * provider, and `~/…` paths resolved from `homeDir`.
   * Later paths take precedence — a skill with the same name overwrites an earlier one.
   */
  paths?: string[];
  /**
   * Virtual home directory used to resolve `~/…` skill paths.
   * Defaults to `/home/agent`.
   */
  homeDir?: string;
}

// ── Discovery ─────────────────────────────────────────────────────────

const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Scan configured paths for `SKILL.md` files and return parsed skill info.
 * Later paths overwrite earlier ones when names collide.
 */
export async function discoverSkills(
  config: SkillsConfig,
  fs: FsProvider
): Promise<SkillInfo[]> {
  assertVirtualFilesystem(fs);

  const skills = new Map<string, SkillInfo>();

  for (const raw of config.paths ?? []) {
    const resolved = resolvePath(raw, config, fs);
    const matches = await findSkillFiles(fs, resolved);

    for (const match of matches) {
      const info = await parseSkillFile(fs, match);
      if (info) {
        skills.set(info.name, info);
      }
    }
  }

  return Array.from(skills.values());
}

// ── Frontmatter parsing ───────────────────────────────────────────────

interface ParsedFrontmatter {
  data: Record<string, string>;
  content: string;
}

/**
 * Minimal YAML frontmatter parser. Handles the simple `key: value` format
 * used by SKILL.md files without requiring an external dependency.
 */
function parseFrontmatter(raw: string): ParsedFrontmatter | null {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) return null;

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  const content = trimmed.slice(endIndex + 4).trim();

  const data: Record<string, string> = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    // Take everything after the first colon so values containing colons are preserved
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      data[key] = value;
    }
  }

  return { data, content };
}

async function parseSkillFile(fs: FsProvider, filePath: string): Promise<SkillInfo | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath);
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    console.warn(`[skills] Could not parse frontmatter: ${filePath}`);
    return null;
  }

  const { name, description } = parsed.data;

  if (!name || !description) {
    console.warn(`[skills] Missing name or description in frontmatter: ${filePath}`);
    return null;
  }

  if (!SKILL_NAME_RE.test(name)) {
    console.warn(
      `[skills] Invalid skill name "${name}" in ${filePath}. ` +
        `Must be lowercase alphanumeric with single hyphens.`
    );
    return null;
  }

  return {
    name,
    description,
    location: filePath,
    content: parsed.content
  };
}

// ── File system helpers ───────────────────────────────────────────────

function resolvePath(raw: string, config: SkillsConfig, fs: FsProvider): string {
  if (raw.startsWith('~/')) {
    return fs.resolvePath(path.join(config.homeDir ?? '/home/agent', raw.slice(2)));
  }
  return fs.resolvePath(raw);
}

/**
 * Recursively find all `SKILL.md` files under `dir`.
 */
async function findSkillFiles(fs: FsProvider, dir: string): Promise<string[]> {
  const results: string[] = [];

  let visit = async (currentDir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(currentDir);
    } catch {
      // Directory doesn't exist or isn't readable — silently skip
      return;
    }

    for (const entry of entries) {
      let entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory) {
        await visit(entryPath);
      } else if (entry.name === 'SKILL.md') {
        results.push(entryPath);
      }
    }
  };

  await visit(dir);
  return results;
}

/**
 * List auxiliary files in a skill directory (everything except SKILL.md).
 * Returns up to `limit` absolute paths.
 */
export async function scanSkillFiles(
  fs: FsProvider,
  dir: string,
  limit = 10
): Promise<string[]> {
  assertVirtualFilesystem(fs);

  const files: string[] = [];

  let visit = async (currentDir: string): Promise<void> => {
    if (files.length >= limit) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= limit) return;

      let entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory) {
        await visit(entryPath);
      } else if (entry.name !== 'SKILL.md') {
        files.push(entryPath);
      }
    }
  };

  await visit(dir);
  return files;
}

function assertVirtualFilesystem(fs: FsProvider) {
  if (fs.scope !== 'virtual') {
    throw new Error('Skill loading requires a virtual filesystem provider.');
  }
}
