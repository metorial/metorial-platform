import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { UsageError } from '../lib/safety';
import { parseJsonLines } from './claude';

type ReadFile = { entries: unknown[]; invalidLines: number; unreadable: boolean };

export type ClaudeSessionFiles = { sessionId: string; main: string; subagents: string[] };

let isFile = (path: string) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

let isDirectory = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

let jsonlFilesUnder = (directory: string): string[] =>
  isDirectory(directory)
    ? readdirSync(directory).flatMap(name => {
        let path = join(directory, name);
        if (isDirectory(path)) return jsonlFilesUnder(path);
        return name.endsWith('.jsonl') && isFile(path) ? [path] : [];
      })
    : [];

// A project directory holds `<session id>.jsonl` per main session and the session's subagent
// transcripts under `<session id>/subagents/`, nested further for workflows.
export let claudeSessionFiles = (projectDirectory: string): ClaudeSessionFiles[] => {
  if (!isDirectory(projectDirectory)) {
    throw new UsageError('A --claude-projects entry is not a directory.');
  }

  return readdirSync(projectDirectory)
    .filter(name => name.endsWith('.jsonl') && isFile(join(projectDirectory, name)))
    .sort()
    .map(name => {
      let sessionId = basename(name, '.jsonl');

      return {
        sessionId,
        main: join(projectDirectory, name),
        subagents: jsonlFilesUnder(join(projectDirectory, sessionId, 'subagents')).sort()
      };
    });
};

export let codexRolloutFiles = (directory: string) => {
  if (!isDirectory(directory)) throw new UsageError('--codex-sessions is not a directory.');

  return jsonlFilesUnder(directory).sort();
};

// Errors are reduced to a flag: a parser message can quote the line it failed on.
export let readJsonLines = (path: string): ReadFile => {
  try {
    return { ...parseJsonLines(readFileSync(path, 'utf8')), unreadable: false };
  } catch {
    return { entries: [], invalidLines: 0, unreadable: true };
  }
};

// `resolve` keeps symlinks, so a link to a folder inside a checkout would pass the check.
// The nearest existing ancestor is resolved to its real path; the rest does not exist yet and
// so cannot be a link.
let lexists = (path: string) => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

let isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

let realTarget = (path: string) => {
  let missing: string[] = [];
  let current = resolve(path);

  while (!lexists(current)) {
    let parent = dirname(current);
    if (parent == current) break;

    missing.unshift(basename(current));
    current = parent;
  }

  try {
    return join(realpathSync(current), ...missing);
  } catch {
    throw new UsageError('--out leads through a broken symlink.');
  }
};

let gitRootAbove = (path: string): string | null => {
  let current = path;

  while (true) {
    if (existsSync(join(current, '.git'))) return current;

    let parent = dirname(current);
    if (parent == current) return null;
    current = parent;
  }
};

let isInside = (path: string, root: string) => {
  let rel = relative(root, path);
  return rel == '' || (!rel.startsWith('..') && !rel.startsWith('/'));
};

// Reports hold figures derived from private transcripts, so they never land in a checkout.
export let prepareOutputDirectory = (directory: string) => {
  let target = realTarget(directory);
  let root = gitRootAbove(target);

  if (root && isInside(target, root)) {
    throw new UsageError('--out must be outside any git checkout, such as a scratch folder.');
  }

  mkdirSync(target, { recursive: true });

  return target;
};

export let writeReport = (
  directory: string,
  name: string,
  report: { text: string; json: unknown }
) => {
  for (let file of [`${name}.txt`, `${name}.json`]) {
    let path = join(directory, file);
    if (isLink(path)) {
      throw new UsageError(
        'A report file in --out is a symlink; remove it or pick another folder.'
      );
    }
  }

  writeFileSync(join(directory, `${name}.txt`), report.text);
  writeFileSync(join(directory, `${name}.json`), `${JSON.stringify(report.json, null, 2)}\n`);
};
