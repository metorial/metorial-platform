import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installKey } from './install-key';

let runtime = { bun: '1.4.2', node: 'v22.22.0', os: 'linux', arch: 'x64' };

test('install identity follows dependencies, lifecycle sources and runtime without following ordinary test edits', () => {
  let workspace = mkdtempSync(join(tmpdir(), 'install-key-'));
  let files = [
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'src/unit.test.ts',
    'packages/native/postinstall.ts'
  ];
  try {
    for (let path of files) {
      mkdirSync(join(workspace, path, '..'), { recursive: true });
      writeFileSync(join(workspace, path), 'original');
    }
    let options = { workspace, files, lifecycleDirectories: ['packages/native'], runtime };
    let before = installKey(options);
    writeFileSync(join(workspace, 'src/unit.test.ts'), 'changed');
    expect(installKey(options)).toBe(before);
    for (let path of [
      'package.json',
      'bun.lock',
      'bunfig.toml',
      'packages/native/postinstall.ts'
    ]) {
      writeFileSync(join(workspace, path), 'changed');
      expect(installKey(options)).not.toBe(before);
      writeFileSync(join(workspace, path), 'original');
    }
    for (let patch of [
      { bun: '1.4.3' },
      { node: 'v24' },
      { os: 'darwin' },
      { arch: 'arm64' }
    ]) {
      expect(installKey({ ...options, runtime: { ...runtime, ...patch } })).not.toBe(before);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('captures and restores nested hoisted installs and workspace links', () => {
  let temporary = mkdtempSync(join(tmpdir(), 'install-restore-'));
  let workspace = join(temporary, 'test-workspace');
  try {
    for (let path of [
      'node_modules/normal/index.js',
      'packages/a/node_modules/nested/index.js',
      'packages/a/package.json'
    ]) {
      mkdirSync(join(workspace, path, '..'), { recursive: true });
      writeFileSync(join(workspace, path), path);
    }
    writeFileSync(
      join(workspace, '.test-install-paths.json'),
      JSON.stringify(['node_modules', 'packages/a/node_modules'])
    );
    let execute = (command: string) => {
      let result = Bun.spawnSync(['bun', join(import.meta.dir, 'workspace.ts'), command], {
        env: { ...process.env, RUNNER_TEMP: temporary },
        stdout: 'pipe',
        stderr: 'pipe'
      });
      expect(result.exitCode).toBe(0);
    };
    execute('capture');
    rmSync(join(workspace, 'node_modules'), { recursive: true });
    rmSync(join(workspace, 'packages/a/node_modules'), { recursive: true });
    execute('restore');
    expect(readFileSync(join(workspace, 'node_modules/normal/index.js'), 'utf8')).toBe(
      'node_modules/normal/index.js'
    );
    expect(
      readFileSync(join(workspace, 'packages/a/node_modules/nested/index.js'), 'utf8')
    ).toBe('packages/a/node_modules/nested/index.js');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
