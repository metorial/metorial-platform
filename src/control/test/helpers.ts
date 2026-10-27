import { afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, canonical, writeJson } from '../src/files';
import { defaultPorts } from '../src/environment';
import type { ProjectRoot, WorkspaceMetadata } from '../src/types';

let directories: string[] = [];

export let temporary = () => {
  let path = canonical(mkdtempSync(join(tmpdir(), 'control-ts-')));
  directories.push(path);

  return path;
};

afterEach(() => {
  for (let directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

export let project = (root: string, kind: ProjectRoot['kind'] = 'oss'): ProjectRoot => ({
  root,
  kind,
  oss: kind === 'oss' ? root : join(root, 'oss')
});

export let packageFixture = (
  root: string,
  directory: string,
  name: string,
  manifest?: string,
  scripts: Record<string, string> = {}
) => {
  let path = join(root, directory);
  mkdirSync(path, { recursive: true });
  writeJson(join(path, 'package.json'), { name, scripts });

  if (manifest !== undefined) atomicWrite(join(path, 'control.toml'), manifest);

  return path;
};

export let checkout = (kind: ProjectRoot['kind'] = 'oss') => {
  let root = temporary();
  mkdirSync(join(root, '.git'));
  packageFixture(root, '', kind === 'oss' ? '@metorial/oss' : '@metorial/enterprise');
  mkdirSync(join(root, 'src'), { recursive: true });

  if (kind === 'enterprise') packageFixture(root, 'oss', '@metorial/oss');

  return project(root, kind);
};

export let workspaceData = (
  root: string,
  overrides: Partial<WorkspaceMetadata> = {}
): WorkspaceMetadata => ({
  id: 'feature',
  hostname: 'metorial-feature.localhost',
  branch: 'feature',
  source_root: root,
  runtime: 'host',
  service_ports: { ...defaultPorts },
  endpoint_ports: {},
  ...overrides
});

export let executable = (directory: string, name: string, source: string) => {
  let path = join(directory, name);
  atomicWrite(path, `#!${process.execPath}\n${source}\n`);

  return Bun.spawnSync(['chmod', '+x', path]).exitCode === 0
    ? path
    : (() => {
        throw new Error(`could not make ${path} executable`);
      })();
};
