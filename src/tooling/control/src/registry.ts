import { dirname, join, relative, resolve } from 'path';
import { discoverControlFiles, loadControlConfigSync } from './discovery';
import { resolveControlDir, resolveEntrypoint, resolveOssRoot } from './entrypoint';
import {
  DuplicateServiceError,
  InvalidFlagsError,
  listServiceNames,
  NoTestError,
  NotInServiceDirError,
  suggestServiceName,
  UnknownServiceError
} from './errors';
import type { ControlService, ServiceRegistry } from './types';

let normalizeDir = (dir: string): string => resolve(dir);

export let hasTest = (service: ControlService, mode: 'e2e' | 'unit'): boolean => {
  if (mode === 'e2e') return !!service.config.test?.e2e;
  return !!service.config.test?.unit;
};

export let buildRegistry = (controlRoot: string): ServiceRegistry => {
  let ossRoot = resolveOssRoot(controlRoot);
  let files = discoverControlFiles(controlRoot);
  let services: ControlService[] = [];
  let byName = new Map<string, ControlService>();
  let byDir = new Map<string, ControlService>();

  for (let controlFile of files) {
    let dir = normalizeDir(dirname(controlFile));
    if (byDir.has(dir)) continue;

    let config = loadControlConfigSync(controlFile);
    let name = config.control.name;
    if (byName.has(name)) {
      throw new DuplicateServiceError({
        name,
        existing: byName.get(name)!.dir,
        duplicate: dir
      });
    }

    let service: ControlService = {
      name,
      dir,
      relPath: relative(controlRoot, dir),
      controlFile,
      config
    };

    services.push(service);
    byName.set(name, service);
    byDir.set(dir, service);
  }

  services.sort((a, b) => a.name.localeCompare(b.name));

  return { controlRoot, ossRoot, services, byName, byDir };
};

export let resolveService = (registry: ServiceRegistry, input: string): ControlService => {
  let byName = registry.byName.get(input);
  if (byName) return byName;

  let candidates = [
    resolve(registry.controlRoot, input),
    resolve(registry.ossRoot, input.replace(/^oss\//, '')),
    resolve(registry.controlRoot, 'oss', input.replace(/^oss\//, ''))
  ];

  for (let candidate of candidates) {
    let normalized = normalizeDir(candidate);
    let service = registry.byDir.get(normalized);
    if (service) return service;
  }

  try {
    let dir = resolveControlDir(registry.controlRoot, input);
    let service = registry.byDir.get(normalizeDir(dir));
    if (service) return service;
  } catch {
    // fall through
  }

  let known = listServiceNames(registry);
  throw new UnknownServiceError({
    input,
    known,
    suggestion: suggestServiceName(input, known)
  });
};

export let findServiceForCwd = (registry: ServiceRegistry, cwd: string): ControlService | null => {
  let dir = resolve(cwd);
  let controlRoot = resolve(registry.controlRoot);

  while (dir.startsWith(controlRoot) || dir === controlRoot) {
    let service = registry.byDir.get(normalizeDir(dir));
    if (service) return service;
    if (dir === controlRoot) break;
    dir = dirname(dir);
  }

  return null;
};

export let resolveControlDepTarget = (
  registry: ServiceRegistry,
  service: ControlService,
  controlPath: string
): ControlService | null => {
  let childDir = normalizeDir(resolve(service.dir, controlPath));
  let byDir = registry.byDir.get(childDir);
  if (byDir) return byDir;

  childDir = normalizeDir(
    resolve(registry.ossRoot, controlPath.replace(/^oss\//, 'src/systems/').replace(/^src\//, 'src/'))
  );
  byDir = registry.byDir.get(childDir);
  if (byDir) return byDir;

  try {
    let dir = resolveControlDir(registry.controlRoot, controlPath);
    return registry.byDir.get(normalizeDir(dir)) ?? null;
  } catch {
    return null;
  }
};

export let resolveTargets = (opts: {
  registry: ServiceRegistry;
  cwd: string;
  target?: string;
  all?: boolean;
  filters?: string[];
  mode?: 'e2e' | 'unit';
}): ControlService[] => {
  if (opts.all && opts.filters?.length) {
    throw new InvalidFlagsError(
      'Cannot use --all and --filter together',
      'Use --all to run every service, or --filter to select specific ones'
    );
  }

  if (opts.all) {
    if (!opts.mode) throw new InvalidFlagsError('Mode is required when using --all');
    return opts.registry.services.filter(s => hasTest(s, opts.mode!));
  }

  if (opts.filters?.length) {
    if (!opts.mode) throw new InvalidFlagsError('Mode is required when using --filter');
    return opts.filters.map(name => {
      let service = opts.registry.byName.get(name);
      if (!service) {
        let known = listServiceNames(opts.registry);
        throw new UnknownServiceError({
          input: name,
          known,
          suggestion: suggestServiceName(name, known)
        });
      }
      if (!hasTest(service, opts.mode!)) {
        throw new NoTestError({ name, mode: opts.mode! });
      }
      return service;
    });
  }

  if (opts.target) {
    return [resolveService(opts.registry, opts.target)];
  }

  let service = findServiceForCwd(opts.registry, opts.cwd);
  if (!service) {
    throw new NotInServiceDirError({
      cwd: opts.cwd,
      controlRoot: opts.registry.controlRoot
    });
  }

  if (opts.mode && !hasTest(service, opts.mode)) {
    throw new NoTestError({ name: service.name, mode: opts.mode });
  }

  return [service];
};

export let getRegistry = (opts: { cwd: string; entrypoint?: string }): ServiceRegistry => {
  let controlRoot = resolveEntrypoint(opts);
  return buildRegistry(controlRoot);
};
