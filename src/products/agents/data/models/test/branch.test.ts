import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { openOverrideBranch } from '../src/reconcile/branch';

let branchName = 'model-catalog/overrides';
let overridesPath = 'pkg/overrides';
let tempDirs: string[] = [];

let git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    ['-C', cwd, '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
    { encoding: 'utf8' }
  ).trim();

let tempDir = () => {
  let dir = mkdtempSync(path.join(os.tmpdir(), 'branch-test-'));
  tempDirs.push(dir);
  return dir;
};

let write = (root: string, file: string, content: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};

let clone = (remote: string) => {
  let dir = path.join(tempDir(), 'work');
  execFileSync('git', ['clone', '--quiet', `file://${remote}`, dir]);
  return dir;
};

let open = (root: string, lines: string[] = []) =>
  openOverrideBranch({
    root,
    name: branchName,
    overridesDir: path.join(root, overridesPath),
    log: line => lines.push(line)
  });

describe('override branch', () => {
  let remote: string;

  beforeEach(() => {
    remote = path.join(tempDir(), 'remote.git');
    execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', remote]);

    let seed = clone(remote);
    write(seed, `${overridesPath}/offerings/a.json`, '{"a":1}\n');
    write(seed, 'pkg/other.txt', 'x\n');
    git(seed, 'add', '-A');
    git(seed, 'commit', '--quiet', '-m', 'seed');
    git(seed, 'push', '--quiet', 'origin', 'HEAD:main');
  });

  afterAll(() => {
    for (let dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('commits and pushes each batch to a new branch', async () => {
    let work = clone(remote);
    let lines: string[] = [];
    let branch = await open(work, lines);

    expect(branch).toMatchObject({ name: branchName, resumed: false });
    expect(git(work, 'branch', '--show-current')).toBe(branchName);

    write(work, `${overridesPath}/offerings/b.json`, '{"b":1}\n');
    await branch!.save('batch 1');

    let message = git(remote, 'log', '-1', '--format=%B', branchName);
    expect(message).toContain('batch 1');
    expect(message).toContain(`Base: ${git(work, 'rev-parse', 'main')}`);
    expect(git(remote, 'show', `${branchName}:${overridesPath}/offerings/b.json`)).toBe(
      '{"b":1}'
    );
    expect(lines.some(line => line.includes('pushed'))).toBe(true);
  });

  it('pushes nothing when a batch changed nothing', async () => {
    let work = clone(remote);
    let lines: string[] = [];
    let branch = await open(work, lines);

    await branch!.save('batch 1');

    expect(git(remote, 'branch', '--list', branchName)).toBe('');
    expect(lines.some(line => line.includes('pushed'))).toBe(false);
  });

  it('resumes a branch from an earlier run and builds on it', async () => {
    let first = clone(remote);
    let firstBranch = await open(first);
    write(first, `${overridesPath}/offerings/b.json`, '{"b":1}\n');
    await firstBranch!.save('batch 1');

    let second = clone(remote);
    let lines: string[] = [];
    let secondBranch = await open(second, lines);

    expect(secondBranch!.resumed).toBe(true);
    expect(readFileSync(path.join(second, overridesPath, 'offerings/b.json'), 'utf8')).toBe(
      '{"b":1}\n'
    );
    expect(lines.some(line => line.includes('resumed'))).toBe(true);

    write(second, `${overridesPath}/offerings/c.json`, '{"c":1}\n');
    await secondBranch!.save('batch 2');

    expect(git(remote, 'show', `${branchName}:${overridesPath}/offerings/b.json`)).toBe(
      '{"b":1}'
    );
    expect(git(remote, 'show', `${branchName}:${overridesPath}/offerings/c.json`)).toBe(
      '{"c":1}'
    );
    expect(git(remote, 'rev-list', '--count', `main..${branchName}`)).toBe('2');
  });

  it('keeps files the branch removed removed', async () => {
    let first = clone(remote);
    let firstBranch = await open(first);
    rmSync(path.join(first, overridesPath, 'offerings/a.json'));
    write(first, `${overridesPath}/offerings/b.json`, '{"b":1}\n');
    await firstBranch!.save('batch 1');

    let second = clone(remote);
    await open(second);

    expect(existsSync(path.join(second, overridesPath, 'offerings/a.json'))).toBe(false);
    expect(existsSync(path.join(second, overridesPath, 'offerings/b.json'))).toBe(true);
  });

  it('discards the branch when the overrides changed on the default branch meanwhile', async () => {
    let first = clone(remote);
    let firstBranch = await open(first);
    write(first, `${overridesPath}/offerings/b.json`, '{"b":1}\n');
    await firstBranch!.save('batch 1');

    let other = clone(remote);
    write(other, `${overridesPath}/offerings/z.json`, '{"z":1}\n');
    git(other, 'add', '-A');
    git(other, 'commit', '--quiet', '-m', 'manual override');
    git(other, 'push', '--quiet', 'origin', 'HEAD:main');

    let second = clone(remote);
    let lines: string[] = [];
    let secondBranch = await open(second, lines);

    expect(secondBranch!.resumed).toBe(false);
    expect(existsSync(path.join(second, overridesPath, 'offerings/b.json'))).toBe(false);
    expect(existsSync(path.join(second, overridesPath, 'offerings/z.json'))).toBe(true);
    expect(lines.some(line => line.includes('discarding'))).toBe(true);

    write(second, `${overridesPath}/offerings/c.json`, '{"c":1}\n');
    await secondBranch!.save('batch 2');

    expect(git(remote, 'rev-list', '--count', `main..${branchName}`)).toBe('1');
    expect(
      git(remote, 'ls-tree', '-r', '--name-only', branchName, overridesPath)
    ).not.toContain('b.json');
  });

  it('still resumes when only files outside the overrides moved on', async () => {
    let first = clone(remote);
    let firstBranch = await open(first);
    write(first, `${overridesPath}/offerings/b.json`, '{"b":1}\n');
    await firstBranch!.save('batch 1');

    let other = clone(remote);
    write(other, 'pkg/other.txt', 'changed\n');
    git(other, 'add', '-A');
    git(other, 'commit', '--quiet', '-m', 'code change');
    git(other, 'push', '--quiet', 'origin', 'HEAD:main');

    let second = clone(remote);
    let secondBranch = await open(second);

    expect(secondBranch!.resumed).toBe(true);
    expect(readFileSync(path.join(second, 'pkg/other.txt'), 'utf8')).toBe('changed\n');
  });

  it('gives up quietly when origin is unreachable', async () => {
    let work = clone(remote);
    rmSync(remote, { recursive: true, force: true });
    let lines: string[] = [];

    expect(await open(work, lines)).toBeNull();
    expect(lines[0]).toContain("can't reach origin");
  });
});
