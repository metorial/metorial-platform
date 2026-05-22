import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from 'smol-toml';
import type { ControlConfig, ControlDep, ResolvedDep, ResolvedGraph } from '../types';
import { MOCK_DEFINITIONS, PRESET_PORTS } from '../types';
import { interpolateEnv } from './env';
import { resolveControlDir, resolveOssRoot } from '../entrypoint';
import type { ServiceRegistry } from '../types';
import { resolveControlDepTarget } from '../registry';

let loadConfig = (controlFile: string): ControlConfig => {
  return parse(readFileSync(controlFile, 'utf8')) as ControlConfig;
};

let resolveDepKind = (dep: ControlDep): ResolvedDep['kind'] => {
  if (dep.mock) return 'mock';
  if (dep.control) return 'control';
  if (dep.preset) return 'preset';
  if (dep.inline !== undefined && dep.inline !== false) return 'inline';
  if (dep.image) return 'docker';
  throw new Error(`Dependency "${dep.name}" must specify mock, control, preset, inline, or image`);
};

let resolveDepPort = (dep: ControlDep): number | undefined => {
  if (dep.port) return dep.port;
  if (dep.mock) return MOCK_DEFINITIONS[dep.mock]?.port;
  if (dep.preset) return PRESET_PORTS[dep.preset];
  if (typeof dep.inline === 'object' && dep.inline.port) return dep.inline.port;
  return undefined;
};

let resolveChildControlDir = (opts: {
  entrypoint: string;
  ossRoot: string;
  targetDir: string;
  controlPath: string;
  registry?: ServiceRegistry;
}): string => {
  if (opts.registry) {
    let service = opts.registry.byDir.get(resolve(opts.targetDir));
    if (service) {
      let child = resolveControlDepTarget(opts.registry, service, opts.controlPath);
      if (child) return child.dir;
    }

    for (let svc of opts.registry.services) {
      if (resolve(svc.dir) === resolve(opts.targetDir)) {
        let child = resolveControlDepTarget(opts.registry, svc, opts.controlPath);
        if (child) return child.dir;
      }
    }
  }

  let childDir = resolve(opts.targetDir, opts.controlPath);
  if (existsSync(join(childDir, 'control.toml'))) return childDir;

  childDir = resolve(
    opts.ossRoot,
    opts.controlPath.replace(/^oss\//, 'src/systems/').replace(/^src\//, 'src/')
  );
  if (existsSync(join(childDir, 'control.toml'))) return childDir;

  childDir = resolveControlDir(opts.entrypoint, opts.controlPath);
  return childDir;
};

export let resolveGraph = (opts: {
  entrypoint: string;
  targetDir: string;
  rootPrefix?: string;
  visiting?: Set<string>;
  registry?: ServiceRegistry;
}): ResolvedGraph => {
  let controlFile = join(opts.targetDir, 'control.toml');
  if (!existsSync(controlFile)) throw new Error(`Missing control.toml at ${opts.targetDir}`);

  let config = loadConfig(controlFile);
  let name = config.control.name;
  let rootPrefix = opts.rootPrefix ?? name;
  let graphKey = rootPrefix === name ? name : `${rootPrefix}/${name}`;

  let visiting = opts.visiting ?? new Set<string>();
  if (visiting.has(graphKey)) throw new Error(`Circular control dependency detected at ${graphKey}`);
  visiting.add(graphKey);

  let entrypoint = opts.entrypoint;
  let ossRoot = resolveOssRoot(entrypoint);
  let serviceComposeName = `${rootPrefix}-service`;
  let testRunnerComposeName =
    config.test?.e2e?.runner === 'sidecar' ? `${rootPrefix}-test` : serviceComposeName;

  let depHosts: Record<string, { host: string; port?: number }> = {};
  let resolvedDeps: ResolvedDep[] = [];

  for (let dep of config.deps ?? []) {
    let alias = dep.name;
    let depComposeName = `${rootPrefix}-${dep.name}`;
    let port = resolveDepPort(dep);

    depHosts[dep.name] = { host: alias, port };

    let kind = resolveDepKind(dep);
    let resolved: ResolvedDep = {
      key: `${graphKey}:${dep.name}`,
      name: dep.name,
      composeName: depComposeName,
      alias,
      port,
      kind,
      config: dep,
      sourceDir: opts.targetDir,
      children: undefined
    };

    if (kind === 'control' && dep.control) {
      let childDir = resolveChildControlDir({
        entrypoint,
        ossRoot,
        targetDir: opts.targetDir,
        controlPath: dep.control,
        registry: opts.registry
      });

      resolved.children = resolveGraph({
        entrypoint,
        targetDir: childDir,
        rootPrefix,
        visiting: new Set(visiting),
        registry: opts.registry
      });

      let childPort = resolved.children.config.service?.port;
      depHosts[dep.name] = {
        host: alias,
        port: childPort ?? port
      };
    }

    resolvedDeps.push(resolved);
  }

  let env = interpolateEnv(config.env ?? {}, depHosts);

  return {
    name,
    dir: opts.targetDir,
    config,
    entrypoint,
    ossRoot,
    rootPrefix,
    deps: resolvedDeps,
    depHosts,
    env,
    serviceComposeName,
    testRunnerComposeName
  };
};
