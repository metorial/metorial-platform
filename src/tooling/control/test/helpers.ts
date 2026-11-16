import { afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, canonical, writeJson } from '../src/files';
import { defaultPorts } from '../src/environment';
import * as commands from '../src/process';
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

  if (manifest !== undefined) writeManifest(path, manifest);

  return path;
};

export let writeManifest = (directory: string, toml: string) =>
  atomicWrite(
    join(directory, 'control', 'index.ts'),
    `import { rawProject } from '@metorial/control/raw';\n\nexport default rawProject(${JSON.stringify(Bun.TOML.parse(toml))});\n`
  );

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

export let listenerFixture = async (cwd: string, ignoreTerm = false) => {
  let child = commands.spawn(
    process.execPath,
    [
      '-e',
      `let net = require('node:net');
      ${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''}
      let server = net.createServer();
      server.listen(0, '127.0.0.1', () => console.log(server.address().port));`
    ],
    cwd,
    {},
    false,
    true
  );
  child.stdin?.end();

  let port = await new Promise<number>((resolve, reject) => {
    let output = '';
    let timer = setTimeout(() => reject(new Error('listener did not start')), 5000);
    child.once('error', reject);
    child.once('close', () => {
      clearTimeout(timer);
      reject(new Error('listener exited before starting'));
    });
    child.stdout?.on('data', chunk => {
      output += chunk.toString();
      if (!output.includes('\n')) return;
      clearTimeout(timer);
      resolve(Number(output.trim()));
    });
  }).catch(error => {
    commands.signalTree(child, 'SIGKILL');

    throw error;
  });

  return { child, port };
};
