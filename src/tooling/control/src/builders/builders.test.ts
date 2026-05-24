import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'bun:test';
import { createBuildPlan } from './index';
import { resolveBuildPaths } from './pathing';
import type { ControlConfig, ControlService, ServiceRegistry } from '../types';

let tempRoots: string[] = [];

let write = (path: string, content = '') => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

let writeNxGraph = (workspaceRoot: string, graph: unknown) => {
  write(join(workspaceRoot, '.nx/workspace-data/project-graph.json'), JSON.stringify(graph, null, 2));
};

let makeRegistry = (config: ControlConfig, relPath: string): {
  root: string;
  service: ControlService;
  registry: ServiceRegistry;
} => {
  let root = mkdtempSync('/tmp/control-builders-');
  tempRoots.push(root);

  let ossRoot = join(root, 'oss');
  let serviceDir = join(root, relPath);
  mkdirSync(join(ossRoot, 'src/systems'), { recursive: true });
  mkdirSync(serviceDir, { recursive: true });
  write(join(serviceDir, 'control.toml'), '');

  let service: ControlService = {
    name: config.control.name,
    dir: serviceDir,
    relPath,
    controlFile: join(serviceDir, 'control.toml'),
    config
  };

  let registry: ServiceRegistry = {
    controlRoot: root,
    ossRoot,
    services: [service],
    byName: new Map([[service.name, service]]),
    byDir: new Map([[service.dir, service]])
  };

  return { root, service, registry };
};

afterEach(() => {
  for (let root of tempRoots.splice(0, tempRoots.length)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('build path resolution', () => {
  it('resolves service-relative manifests, .. paths, globs, and repo-root escapes', () => {
    let config: ControlConfig = {
      control: { name: 'fixture' },
      build: {
        builder: 'node',
        context: 'repo',
        manifests: { files: ['package.json', '../db/package.json'] },
        inputs: { paths: ['src/**', '../../scripts/*.sh', '//shared/generated.txt'] },
        artifacts: { copy: [] },
        runtime: { command: 'node index.js' }
      }
    };

    let { root, service, registry } = makeRegistry(
      config,
      'oss/src/systems/fixture/service'
    );
    write(join(service.dir, 'package.json'), '{}');
    write(join(root, 'oss/src/systems/fixture/db/package.json'), '{}');
    write(join(service.dir, 'src/index.ts'), 'export {};');
    write(join(root, 'oss/src/systems/scripts/setup.sh'), 'echo setup');
    write(join(root, 'shared/generated.txt'), 'generated');

    let paths = resolveBuildPaths({
      service,
      registry,
      contextRoot: root,
      patterns: ['package.json', '../db/package.json', 'src/**', '../../scripts/*.sh', '//shared/generated.txt'],
      label: 'input'
    });

    expect(paths.some(path => path.relativeToService === 'package.json')).toBe(true);
    expect(paths.some(path => path.relativeToService === '../db/package.json')).toBe(true);
    expect(paths.some(path => path.relativeToContext === 'shared/generated.txt')).toBe(true);
    expect(paths.some(path => path.relativeToContext.endsWith('setup.sh'))).toBe(true);
  });
});

describe('builder plans', () => {
  it('creates a node build plan', () => {
    let config: ControlConfig = {
      control: { name: 'node-svc' },
      build: {
        builder: 'node',
        context: 'oss',
        project: '@demo/node-svc',
        target: 'server:build',
        automations: [
          {
            name: 'db',
            kind: 'run-targets',
            target: 'prisma:generate',
            projects: ['@demo/node-svc']
          }
        ],
        artifacts: { copy: [{ from: '//node_modules', to: '/app/node_modules' }] },
        runtime: { command: 'node dist/index.js' }
      }
    };
    let { root, service, registry } = makeRegistry(config, 'oss/src/systems/demo/service');
    write(join(root, 'oss/package.json'), '{}');
    write(join(root, 'oss/bun.lock'), '');
    write(join(root, 'oss/tsconfig.json'), '{}');
    write(join(service.dir, 'package.json'), '{}');
    write(join(service.dir, 'src/index.ts'), 'export {};');
    write(join(root, 'node_modules/.keep'), '');
    writeNxGraph(join(root, 'oss'), {
      nodes: {
        '@demo/node-svc': {
          name: '@demo/node-svc',
          type: 'lib',
          data: { root: 'src/systems/demo/service' }
        }
      },
      dependencies: {
        '@demo/node-svc': []
      }
    });

    let plan = createBuildPlan(service, registry);
    expect(plan?.builder).toBe('node');
    expect(plan?.project).toBe('@demo/node-svc');
    expect(plan?.dockerfilePath.endsWith('Dockerfile')).toBe(true);
    expect(plan?.automations[0]?.command).toContain('prisma:generate');
    expect(plan?.inputPaths.some(path => path.relativeToContext === 'src/systems/demo/service')).toBe(true);
  });

  it('creates a rust build plan', () => {
    let config: ControlConfig = {
      control: { name: 'rust-svc' },
      build: {
        builder: 'rust',
        manifests: { files: ['Cargo.toml', 'Cargo.lock'] },
        inputs: { paths: ['src/**'] },
        main: { steps: [{ run: 'cargo build --release' }] },
        artifacts: { copy: [{ from: 'target/release/app', to: '/app/app' }] },
        runtime: { command: '/app/app' }
      }
    };
    let { service, registry } = makeRegistry(config, 'oss/src/systems/rust/service');
    write(join(service.dir, 'Cargo.toml'), '[package]\nname="app"\nversion="0.1.0"\n');
    write(join(service.dir, 'Cargo.lock'), '');
    write(join(service.dir, 'src/lib.rs'), 'pub fn demo() {}');

    let plan = createBuildPlan(service, registry);
    expect(plan?.builder).toBe('rust');
    expect(plan?.mainSteps[0]?.run).toContain('cargo build');
  });

  it('creates a go build plan', () => {
    let config: ControlConfig = {
      control: { name: 'go-svc' },
      build: {
        builder: 'go',
        manifests: { files: ['go.mod', 'go.sum'] },
        inputs: { paths: ['cmd/**', 'internal/**'] },
        main: { steps: [{ run: 'go build -o /tmp/service ./cmd/service' }] },
        artifacts: { copy: [{ from: '/tmp/service', to: '/app/service' }] },
        runtime: { command: '/app/service' }
      }
    };
    let { service, registry } = makeRegistry(config, 'oss/src/systems/go/service');
    write(join(service.dir, 'go.mod'), 'module example.com/service\n');
    write(join(service.dir, 'go.sum'), '');
    write(join(service.dir, 'cmd/service/main.go'), 'package main\nfunc main() {}\n');
    write(join(service.dir, 'internal/demo/demo.go'), 'package demo\n');

    let plan = createBuildPlan(service, registry);
    expect(plan?.builder).toBe('go');
    expect(plan?.runtime.base_image).toContain('distroless');
  });
});
