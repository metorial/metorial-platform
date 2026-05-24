import { existsSync, statSync } from 'fs';
import { relative, resolve } from 'path';
import { ControlError } from '../errors';
import type {
  ControlBuildCopy,
  ControlBuildConfig,
  ControlBuildInstallLayer,
  ControlBuildStep,
  ControlService,
  GeneratedBuildArtifact,
  GeneratedBuildInstallLayer,
  GeneratedBuildPath,
  GeneratedBuildStep,
  ServiceRegistry
} from '../types';

let hasGlob = (input: string): boolean => /[*?[\]{}]/.test(input);

let normalizeSlashes = (input: string): string => input.replace(/\\/g, '/');

let assertInsideRoot = (absPath: string, root: string, label: string) => {
  let normalizedRoot = normalizeSlashes(resolve(root));
  let normalizedPath = normalizeSlashes(resolve(absPath));
  if (normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + '/')) return;

  throw new ControlError({
    code: 'build_path_outside_root',
    message: `Resolved ${label} path escapes the workspace root`,
    details: [`Path: ${normalizedPath}`, `Root: ${normalizedRoot}`],
    hint: 'Use paths relative to control.toml and keep them inside the repository'
  });
};

export let resolveBuildContextRoot = (
  service: ControlService,
  registry: ServiceRegistry,
  build: ControlBuildConfig
): { kind: 'oss' | 'repo' | 'relative'; root: string } => {
  if (build.context === 'repo') {
    return { kind: 'repo', root: registry.controlRoot };
  }

  if (!build.context || build.context === 'oss') {
    return { kind: 'oss', root: registry.ossRoot };
  }

  let root = resolve(service.dir, build.context);
  assertInsideRoot(root, registry.controlRoot, 'build context');
  return { kind: 'relative', root };
};

let resolvePatternBase = (
  service: ControlService,
  registry: ServiceRegistry,
  rawPattern: string
): { cwd: string; pattern: string } => {
  if (rawPattern.startsWith('//')) {
    return {
      cwd: registry.controlRoot,
      pattern: rawPattern.slice(2)
    };
  }

  return {
    cwd: service.dir,
    pattern: rawPattern
  };
};

let tryResolveDirectoryPattern = (
  service: ControlService,
  registry: ServiceRegistry,
  rawPattern: string
): string[] | null => {
  let resolvedBase = resolvePatternBase(service, registry, rawPattern);
  let normalized = normalizeSlashes(rawPattern);
  if (!normalized.endsWith('/**') && !normalized.endsWith('/**/*')) return null;

  let absBase = resolve(resolvedBase.cwd, resolvedBase.pattern.replace(/\/\*\*(\/\*)?$/, ''));
  if (!existsSync(absBase)) return [];
  return [absBase];
};

let expandGlob = (
  service: ControlService,
  registry: ServiceRegistry,
  rawPattern: string
): string[] => {
  let maybeDir = tryResolveDirectoryPattern(service, registry, rawPattern);
  if (maybeDir) return maybeDir;

  let base = resolvePatternBase(service, registry, rawPattern);
  let glob = new Bun.Glob(base.pattern);
  let results = [...glob.scanSync({ cwd: base.cwd, absolute: true, dot: true })];
  results.sort((a, b) => a.localeCompare(b));
  return results;
};

export let resolveBuildPaths = (opts: {
  service: ControlService;
  registry: ServiceRegistry;
  contextRoot: string;
  patterns?: string[];
  label: string;
  allowMissing?: boolean;
}): GeneratedBuildPath[] => {
  let patterns = opts.patterns ?? [];
  let files = new Map<string, GeneratedBuildPath>();

  for (let pattern of patterns) {
    let base = resolvePatternBase(opts.service, opts.registry, pattern);
    let matches = hasGlob(pattern)
      ? expandGlob(opts.service, opts.registry, pattern)
      : [resolve(base.cwd, base.pattern)];

    if (matches.length === 0 && !opts.allowMissing) {
      throw new ControlError({
        code: 'build_path_missing',
        message: `No matches found for ${opts.label} pattern "${pattern}"`,
        details: [`Service: ${opts.service.name}`, `control.toml: ${opts.service.controlFile}`]
      });
    }

    for (let absPath of matches) {
      assertInsideRoot(absPath, opts.registry.controlRoot, opts.label);
      let exists = existsSync(absPath);
      if (!exists && !opts.allowMissing) {
        throw new ControlError({
          code: 'build_path_missing',
          message: `Resolved ${opts.label} path does not exist`,
          details: [`Pattern: ${pattern}`, `Path: ${absPath}`]
        });
      }

      let relService = normalizeSlashes(relative(opts.service.dir, absPath) || '.');
      let relContext = normalizeSlashes(relative(opts.contextRoot, absPath) || '.');
      files.set(absPath, {
        pattern,
        absolutePath: absPath,
        relativeToService: relService,
        relativeToContext: relContext,
        exists
      });
    }
  }

  return [...files.values()].sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
};

export let resolveBuildSteps = (opts: {
  service: ControlService;
  registry: ServiceRegistry;
  contextRoot: string;
  steps?: ControlBuildStep[];
}): GeneratedBuildStep[] => {
  let steps = opts.steps ?? [];

  return steps.map(step => {
    let cwdBase = step.cwd ? resolvePatternBase(opts.service, opts.registry, step.cwd) : null;
    let cwdAbsolute = cwdBase ? resolve(cwdBase.cwd, cwdBase.pattern) : opts.service.dir;
    assertInsideRoot(cwdAbsolute, opts.registry.controlRoot, 'build step cwd');

    return {
      run: step.run,
      cwd: step.cwd,
      cwdAbsolute,
      cwdRelativeToContext: normalizeSlashes(relative(opts.contextRoot, cwdAbsolute) || '.'),
      mode: step.mode ?? 'default'
    };
  });
};

let defaultInstallCommand = (layer: ControlBuildInstallLayer, linker?: string): string => {
  if (layer.command) return layer.command;
  if (layer.tool === 'bun') return `bun install --linker=${linker ?? 'hoisted'}`;
  if (layer.tool === 'go') return 'go mod download';
  if (layer.tool === 'cargo') return 'cargo fetch';
  throw new ControlError({
    code: 'build_install_layer_missing_command',
    message: `Install layer "${layer.name ?? 'unnamed'}" must declare a command`,
    hint: 'Set command or use a supported tool: bun, go, cargo'
  });
};

export let resolveBuildInstallLayers = (opts: {
  service: ControlService;
  registry: ServiceRegistry;
  contextRoot: string;
  install?: ControlBuildConfig['install'];
}): GeneratedBuildInstallLayer[] => {
  let layers = opts.install?.layers ?? [];

  return layers.map((layer, index) => {
    let name = (layer.name ?? `${layer.tool ?? 'custom'}-${index + 1}`).replace(/[^a-zA-Z0-9._-]+/g, '-');
    let cwdBase = layer.cwd ? resolvePatternBase(opts.service, opts.registry, layer.cwd) : null;
    let cwdAbsolute = cwdBase ? resolve(cwdBase.cwd, cwdBase.pattern) : opts.service.dir;
    assertInsideRoot(cwdAbsolute, opts.registry.controlRoot, 'install layer cwd');

    return {
      name,
      tool: layer.tool ?? 'custom',
      command: defaultInstallCommand(layer, opts.install?.linker),
      cwd: layer.cwd,
      cwdAbsolute,
      cwdRelativeToContext: normalizeSlashes(relative(opts.contextRoot, cwdAbsolute) || '.'),
      manifestFiles: resolveBuildPaths({
        service: opts.service,
        registry: opts.registry,
        contextRoot: opts.contextRoot,
        patterns: layer.manifests,
        label: `install layer "${name}" manifest`
      })
    };
  });
};

export let resolveBuildArtifacts = (opts: {
  service: ControlService;
  registry: ServiceRegistry;
  contextRoot: string;
  artifacts?: ControlBuildCopy[];
}): GeneratedBuildArtifact[] => {
  let artifacts = opts.artifacts ?? [];

  return artifacts.map(artifact => {
    let isContainerAbsolute = artifact.from.startsWith('/') && !artifact.from.startsWith('//');
    let fromBase = isContainerAbsolute
      ? null
      : resolvePatternBase(opts.service, opts.registry, artifact.from);
    let fromAbsolute = isContainerAbsolute
      ? artifact.from
      : resolve(fromBase!.cwd, fromBase!.pattern);

    if (!isContainerAbsolute) {
      assertInsideRoot(fromAbsolute, opts.registry.controlRoot, 'artifact');
    }

    let fromRelativeToContext = isContainerAbsolute
      ? artifact.from
      : normalizeSlashes(relative(opts.contextRoot, fromAbsolute) || '.');

    return {
      from: artifact.from,
      to: artifact.to,
      fromAbsolute,
      fromRelativeToContext
    };
  });
};

export let isDirectoryPath = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};
