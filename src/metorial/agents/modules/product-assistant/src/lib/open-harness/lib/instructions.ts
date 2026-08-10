import { posix as path } from 'node:path';
import type { FsProvider } from '../providers/types';

const FILENAMES = ['AGENTS.md', 'CLAUDE.md'];

/**
 * Walk from `startDir` up to the filesystem root, returning the first
 * AGENTS.md or CLAUDE.md found. AGENTS.md takes precedence in each directory.
 */
export async function findInstructions(
  fs: FsProvider,
  startDir?: string
): Promise<string | undefined> {
  assertVirtualFilesystem(fs);

  let dir = fs.resolvePath(startDir ?? '.');

  while (true) {
    for (const name of FILENAMES) {
      const candidate = path.join(dir, name);
      try {
        if (!(await fs.exists(candidate))) continue;

        let stat = await fs.stat(candidate);
        if (!stat.isFile) continue;

        const content = await fs.readFile(candidate);
        return content.trim() || undefined;
      } catch {
        // not found, try next
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }

  return undefined;
}

function assertVirtualFilesystem(fs: FsProvider) {
  if (fs.scope !== 'virtual') {
    throw new Error('Instruction loading requires a virtual filesystem provider.');
  }
}

/**
 * Build the instruction block that gets prepended to the system prompt.
 */
export async function loadInstructions(
  fs: FsProvider,
  startDir?: string
): Promise<string | undefined> {
  const content = await findInstructions(fs, startDir);
  if (!content) return undefined;

  return [
    "The following instructions come from the project's AGENTS.md file.",
    'They were written by the project maintainers and describe project-specific',
    'conventions, preferences, and rules you must follow.',
    '',
    '<agents-md>',
    content,
    '</agents-md>'
  ].join('\n');
}
