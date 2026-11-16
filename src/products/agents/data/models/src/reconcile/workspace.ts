import { execFile } from 'node:child_process';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

let exec = promisify(execFile);

export let repoRoot = async (cwd: string) =>
  (await exec('git', ['-C', cwd, 'rev-parse', '--show-toplevel'])).stdout.trim();

export let dirtyPaths = async (root: string) => {
  let { stdout } = await exec('git', ['-C', root, 'status', '--porcelain=v1', '-uall', '-z'], {
    maxBuffer: 64 * 1024 * 1024
  });

  return new Set(
    stdout
      .split('\0')
      .filter(Boolean)
      .map(entry => entry.slice(3))
  );
};

let isTracked = async (root: string, file: string) => {
  try {
    await exec('git', ['-C', root, 'ls-files', '--error-unmatch', '--', file]);
    return true;
  } catch {
    return false;
  }
};

// The agent's write tool can reach any path, so whatever it changed outside the allowed
// directories is put back before its decisions are reviewed.
export let restoreOutside = async (opts: {
  root: string;
  before: Set<string>;
  allowed: string[];
}) => {
  let restored: string[] = [];

  for (let file of await dirtyPaths(opts.root)) {
    if (opts.before.has(file) || opts.allowed.some(prefix => file.startsWith(prefix)))
      continue;

    if (await isTracked(opts.root, file))
      await exec('git', ['-C', opts.root, 'checkout', '--', file]);
    else await rm(path.join(opts.root, file), { force: true });
    restored.push(file);
  }

  return restored;
};

// The work directory is uploaded as a CI artifact; nothing an agent echoed into a log or session
// may carry a credential out with it.
export let scrubSecrets = async (dir: string, secrets: string[]) => {
  if (!secrets.length) return;

  for (let entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;

    let file = path.join(entry.parentPath, entry.name);
    let content = await readFile(file, 'utf8');
    let scrubbed = secrets.reduce((text, secret) => text.split(secret).join('***'), content);
    if (scrubbed !== content) await writeFile(file, scrubbed);
  }
};
