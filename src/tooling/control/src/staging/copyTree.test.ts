import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyGitAwareTree } from './copyTree';

let runGit = async (args: string[], cwd: string) => {
  let proc = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      GIT_TEMPLATE_DIR: ''
    }
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    let err = await new Response(proc.stderr).text();
    throw new Error(`git ${args.join(' ')} failed: ${err}`);
  }
};

let createFixtureRepo = async () => {
  let root = mkdtempSync(join(tmpdir(), 'control-copy-fixture-'));
  mkdirSync(join(root, 'node_modules', 'ignored'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'ignored', 'pkg.js'), 'ignored');
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'out.js'), 'ignored');
  writeFileSync(join(root, 'tracked.txt'), 'tracked');
  writeFileSync(join(root, 'untracked.txt'), 'untracked');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\ndist/\n');

  await runGit(['init'], root);
  await runGit(['config', 'user.email', 'test@example.com'], root);
  await runGit(['config', 'user.name', 'Test'], root);
  await runGit(['add', 'tracked.txt', '.gitignore'], root);
  await runGit(['commit', '-m', 'init'], root);

  return root;
};

describe('copyGitAwareTree', () => {
  let fixtureRoot: string;
  let destRoot: string;

  beforeEach(async () => {
    fixtureRoot = await createFixtureRepo();
    destRoot = mkdtempSync(join(tmpdir(), 'control-copy-dest-'));
  });

  afterEach(() => {
    if (fixtureRoot && existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
    if (destRoot && existsSync(destRoot)) rmSync(destRoot, { recursive: true, force: true });
  });

  it('copies tracked and untracked non-ignored files', async () => {
    let result = await copyGitAwareTree({ sourceRoot: fixtureRoot, destRoot });

    expect(result.fileCount).toBeGreaterThan(0);
    expect(readFileSync(join(destRoot, 'tracked.txt'), 'utf8')).toBe('tracked');
    expect(readFileSync(join(destRoot, 'untracked.txt'), 'utf8')).toBe('untracked');
    expect(existsSync(join(destRoot, 'node_modules', 'ignored', 'pkg.js'))).toBe(false);
    expect(existsSync(join(destRoot, 'dist', 'out.js'))).toBe(false);
  });
});
