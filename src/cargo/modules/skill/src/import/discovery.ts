import { posix as path } from 'node:path';

let normalizePath = (value: string) => {
  let normalized = value.replaceAll('\\', '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  return path.normalize(normalized);
};

export let discoverSkillPaths = (filePaths: string[]) => {
  let candidatesByDirectory = new Map<string, string[]>();

  for (let filePath of filePaths) {
    let normalized = normalizePath(filePath);
    if (path.basename(normalized).toLowerCase() !== 'skill.md') continue;

    let directory = path.dirname(normalized);
    let candidates = candidatesByDirectory.get(directory) ?? [];
    candidates.push(normalized);
    candidatesByDirectory.set(directory, candidates);
  }

  for (let [directory, candidates] of candidatesByDirectory) {
    if (candidates.length > 1) {
      throw new Error(`Multiple case variants of SKILL.md exist in ${directory}`);
    }
  }

  let directories = [...candidatesByDirectory.keys()].sort(
    (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)
  );
  let roots: string[] = [];

  for (let directory of directories) {
    let isNested = roots.some(
      root => root === '/' || directory === root || directory.startsWith(`${root}/`)
    );
    if (!isNested) roots.push(directory);
  }

  return roots;
};

export let getRelativeSkillPath = (root: string, filePath: string) => {
  let normalizedRoot = normalizePath(root);
  let normalizedFile = normalizePath(filePath);
  let relative = path.relative(normalizedRoot, normalizedFile);
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return null;

  let segments = relative.split('/');
  if (segments.some(segment => segment === '.' || segment === '..')) return null;
  if (segments.length === 1 && segments[0]!.toLowerCase() === 'skill.md') return '/SKILL.md';
  return `/${relative}`;
};

export let shouldImportSkillPath = (relativePath: string) => {
  let normalized = normalizePath(relativePath);
  if (!normalized.toLowerCase().startsWith('/agents/')) return true;
  return (
    path.dirname(normalized).toLowerCase() === '/agents' &&
    path.extname(normalized).toLowerCase() === '.md'
  );
};
