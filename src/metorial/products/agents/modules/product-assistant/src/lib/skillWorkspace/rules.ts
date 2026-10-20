import { posix as path } from 'node:path';

export let skillRootDocumentPath = '/SKILL.md';
export let maxSkillWorkspaceFiles = 1000;
export let maxLoadableFileBytes = 5 * 1024 * 1024;
export let maxLoadedWorkspaceBytes = 10 * 1024 * 1024;

let formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export class SkippedContentError extends Error {
  override name = 'SkippedContentError';
}

export class WorkspaceLoadBudget {
  private used = 0;

  constructor(
    private limits = { file: maxLoadableFileBytes, total: maxLoadedWorkspaceBytes }
  ) {}

  reserve(filePath: string, bytes: number) {
    if (bytes > this.limits.file) {
      throw new SkippedContentError(
        `${filePath} is ${formatMegabytes(bytes)}, over the ${formatMegabytes(this.limits.file)} per-file limit`
      );
    }
    if (this.used + bytes > this.limits.total) {
      throw new SkippedContentError(
        `${filePath} was not loaded because this request already read ${formatMegabytes(this.used)} of the ${formatMegabytes(this.limits.total)} limit`
      );
    }

    this.used += bytes;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.used -= bytes;
    };
  }
}

let reservedDocumentName = 'SKILL.md';
let agentsDirectoryPath = '/agents';
let allowedSegment = /^[A-Za-z0-9._() \-$]+$/;
let dotOnlySegment = /^\.+$/;
let documentExtensions = new Set(['.md', '.markdown', '.txt']);

export class SkillWorkspaceFsError extends Error {
  constructor(
    readonly code: 'EROFS' | 'EPERM' | 'EINVAL' | 'EFBIG',
    message: string
  ) {
    super(`${code}: ${message}`);
  }
}

export let normalizeWorkspacePath = (value: string) => {
  let normalized = path.normalize(`/${value}`);
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
};

export let isDocumentPath = (filePath: string) =>
  documentExtensions.has(path.extname(filePath).toLowerCase());

export let isPathWithin = (filePath: string, parent: string) =>
  filePath == parent || filePath.startsWith(parent == '/' ? '/' : `${parent}/`);

export let assertValidWorkspacePath = (filePath: string) => {
  for (let segment of filePath.split('/').filter(Boolean)) {
    if (!allowedSegment.test(segment) || dotOnlySegment.test(segment)) {
      throw new SkillWorkspaceFsError(
        'EINVAL',
        `invalid path segment '${segment}' in '${filePath}'. Use only letters, numbers, spaces and . _ - ( ) $`
      );
    }
  }
};

export let assertSkillFileAllowed = (filePath: string) => {
  assertValidWorkspacePath(filePath);

  if (path.basename(filePath) == reservedDocumentName && !isDocumentPath(filePath)) {
    throw new SkillWorkspaceFsError('EPERM', `${reservedDocumentName} is reserved`);
  }

  if (
    path.dirname(filePath) == agentsDirectoryPath &&
    !filePath.toLowerCase().endsWith('.md')
  ) {
    throw new SkillWorkspaceFsError(
      'EPERM',
      `only markdown documents (.md) can be placed in ${agentsDirectoryPath}/`
    );
  }
};

export let assertSkillPathRemovable = (filePath: string) => {
  if (filePath == skillRootDocumentPath) {
    throw new SkillWorkspaceFsError(
      'EPERM',
      `${skillRootDocumentPath} cannot be removed or moved`
    );
  }
};
