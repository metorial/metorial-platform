import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

export type CopyTreeResult = {
  fileCount: number;
  durationMs: number;
};

let ALWAYS_SKIP = new Set(['.git', '.control']);

let runGit = async (args: string[], cwd: string): Promise<{ ok: boolean; stdout: string }> => {
  let proc = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe'
  });
  let stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return { ok: proc.exitCode === 0, stdout };
};

let isGitRepo = async (root: string): Promise<boolean> => {
  let res = await runGit(['rev-parse', '--git-dir'], root);
  return res.ok;
};

let listGitFiles = async (root: string): Promise<string[]> => {
  let res = await runGit(['ls-files', '-co', '--exclude-standard', '-z'], root);
  if (!res.ok) throw new Error(`git ls-files failed in ${root}`);

  let files: string[] = [];
  for (let entry of res.stdout.split('\0')) {
    if (entry) files.push(entry);
  }
  return files;
};

let listSubmodulePaths = async (root: string): Promise<string[]> => {
  let paths = new Set<string>();

  if (existsSync(join(root, '.gitmodules'))) {
    let text = readFileSync(join(root, '.gitmodules'), 'utf8');
    for (let line of text.split('\n')) {
      let match = line.match(/^\s*path\s*=\s*(.+)\s*$/);
      if (match?.[1]) paths.add(match[1].trim());
    }
  }

  let res = await runGit(['ls-files', '-z'], root);
  if (res.ok) {
    for (let entry of res.stdout.split('\0')) {
      if (!entry) continue;
      let full = join(root, entry);
      try {
        if (statSync(full).isDirectory() && existsSync(join(full, '.git'))) {
          paths.add(entry);
        }
      } catch {
        // skip missing paths
      }
    }
  }

  return [...paths];
};

let shouldSkipRelativePath = (relPath: string): boolean => {
  let parts = relPath.split('/');
  for (let part of parts) {
    if (ALWAYS_SKIP.has(part)) return true;
  }
  return false;
};

let copyFilePreservingMode = (src: string, dest: string) => {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  try {
    let mode = statSync(src).mode & 0o777;
    if (mode) chmodSync(dest, mode);
  } catch {
    // ignore chmod failures on unsupported platforms
  }
};

let copyFilesFromGitRoot = async (opts: {
  sourceRoot: string;
  destRoot: string;
  pathPrefix?: string;
  skipPaths?: Set<string>;
}): Promise<number> => {
  let files = await listGitFiles(opts.sourceRoot);
  let count = 0;
  let prefix = opts.pathPrefix ?? '';
  let skipPaths = opts.skipPaths ?? new Set<string>();

  for (let rel of files) {
    if (shouldSkipRelativePath(rel)) continue;
    if ([...skipPaths].some(skip => rel === skip || rel.startsWith(`${skip}/`))) continue;

    let src = join(opts.sourceRoot, rel);
    if (!existsSync(src)) continue;

    try {
      if (!statSync(src).isFile()) continue;
    } catch {
      continue;
    }

    let destRel = prefix ? join(prefix, rel) : rel;
    if (shouldSkipRelativePath(destRel)) continue;

    copyFilePreservingMode(src, join(opts.destRoot, destRel));
    count++;
  }

  return count;
};

let copySubmoduleTrees = async (opts: {
  sourceRoot: string;
  destRoot: string;
  verbose?: boolean;
}): Promise<number> => {
  let submodules = await listSubmodulePaths(opts.sourceRoot);
  let count = 0;

  for (let subPath of submodules) {
    let subSource = join(opts.sourceRoot, subPath);
    if (!existsSync(subSource)) {
      throw new Error(
        `Submodule "${subPath}" is not initialized. Run: git submodule update --init --recursive`
      );
    }

    if (!(await isGitRepo(subSource))) {
      throw new Error(`Submodule "${subPath}" is not a git checkout at ${subSource}`);
    }

    if (opts.verbose) {
      console.error(`[control:stage] Copying submodule ${subPath}...`);
    }

    count += await copyFilesFromGitRoot({
      sourceRoot: subSource,
      destRoot: opts.destRoot,
      pathPrefix: subPath
    });
  }

  return count;
};

export let copyGitAwareTree = async (opts: {
  sourceRoot: string;
  destRoot: string;
  verbose?: boolean;
}): Promise<CopyTreeResult> => {
  let sourceRoot = resolve(opts.sourceRoot);
  let destRoot = resolve(opts.destRoot);
  let started = Date.now();

  if (!(await isGitRepo(sourceRoot))) {
    throw new Error(`Cannot stage workspace: ${sourceRoot} is not a git repository`);
  }

  mkdirSync(destRoot, { recursive: true });

  let submodulePaths = await listSubmodulePaths(sourceRoot);
  let skipPaths = new Set(submodulePaths);

  let fileCount = await copyFilesFromGitRoot({ sourceRoot, destRoot, skipPaths });
  fileCount += await copySubmoduleTrees({ sourceRoot, destRoot, verbose: opts.verbose });

  if (opts.verbose) {
    console.error(
      `[control:stage] Copied ${fileCount} files from ${sourceRoot} to ${destRoot} (${Date.now() - started}ms)`
    );
  }

  return { fileCount, durationMs: Date.now() - started };
};

export let mapPathToStaged = (opts: {
  repoRoot: string;
  stagedRoot: string;
  sourcePath: string;
}): string => {
  let rel = relative(resolve(opts.repoRoot), resolve(opts.sourcePath));
  if (rel.startsWith('..')) return resolve(opts.sourcePath);
  return join(resolve(opts.stagedRoot), rel);
};
