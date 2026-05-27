import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { ControlError } from '../errors';
import { copyGitAwareSelection } from '../staging/copyTree';
import { shouldUsePrebuiltBuildArtifacts } from './base';
import type {
  GeneratedBuildInstallLayer,
  GeneratedBuildPath,
  GeneratedBuildPlan,
  ServiceRegistry,
  WorkspaceSession
} from '../types';
import { renderNodePrunedDockerfile } from './node';

export type MaterializedBuildContext = {
  root: string;
  dockerfilePath: string;
};

let sanitizeName = (input: string) => input.replace(/[^a-zA-Z0-9._-]+/g, '-');

let resolveRelativeToRoot = (root: string, absolutePath: string): string => {
  let rel = relative(root, absolutePath).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..')) {
    throw new ControlError({
      code: 'build_context_copy_outside_root',
      message: `Cannot copy file outside build context root: ${absolutePath}`
    });
  }
  return rel;
};

let rootFilesForPlan = (sourceRoot: string): string[] =>
  ['bun.lock', 'nx.json']
    .map(relativePath => resolve(sourceRoot, relativePath))
    .filter(path => existsSync(path));

let rootInputFilesForPlan = (sourceRoot: string): string[] => {
  let patterns = ['tsconfig.json', 'tsconfig.base.json', 'bunfig.toml'];
  return patterns
    .map(relativePath => resolve(sourceRoot, relativePath))
    .filter(path => existsSync(path));
};

let resolveSourceRoot = (opts: {
  plan: GeneratedBuildPlan;
  registry: ServiceRegistry;
  session?: WorkspaceSession | null;
}): string => {
  if (!opts.session) return opts.plan.contextRoot;

  let relativeToStage = relative(opts.session.stagedEntrypoint, opts.plan.contextRoot);
  if (relativeToStage.startsWith('..')) {
    return opts.plan.contextRoot;
  }

  return resolve(opts.session.repoRoot, relativeToStage);
};

let renderSyntheticWorkspacePackageJson = (opts: {
  manifestFiles: GeneratedBuildPath[];
  sourceRoot: string;
}): string => {
  let packageJsonPath = resolve(opts.sourceRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new ControlError({
      code: 'build_missing_root_package_json',
      message: `Missing package.json at ${packageJsonPath}`
    });
  }

  let base = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>;
  let workspaces = new Set<string>();

  for (let manifest of opts.manifestFiles) {
    let dir = dirname(manifest.relativeToContext).replace(/\\/g, '/');
    if (!dir || dir === '.') continue;
    workspaces.add(dir);
  }

  base.workspaces = [...workspaces].sort((a, b) => a.localeCompare(b));

  return `${JSON.stringify(base, null, 2)}\n`;
};

let cumulativeManifestFiles = (
  layers: GeneratedBuildInstallLayer[],
  index: number
): GeneratedBuildPath[] => {
  let files = new Map<string, GeneratedBuildPath>();
  for (let i = 0; i <= index; i++) {
    for (let file of layers[i]?.manifestFiles ?? []) {
      files.set(file.relativeToContext, file);
    }
  }
  return [...files.values()].sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
};

let copyPath = (source: string, dest: string) => {
  let stat = statSync(source);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (let entry of readdirSync(source)) {
      copyPath(join(source, entry), join(dest, entry));
    }
    return;
  }

  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(source, dest);
};

let materializePrebuiltArtifacts = (opts: {
  plan: GeneratedBuildPlan;
  contextRoot: string;
  sourceRoot: string;
}) => {
  let prebuiltRoot = join(opts.contextRoot, '_prebuilt');
  mkdirSync(prebuiltRoot, { recursive: true });
  let copied = new Set<string>();
  let copyRelativePath = (relativePath: string) => {
    if (copied.has(relativePath)) return;
    let source = resolve(opts.sourceRoot, relativePath);
    if (!existsSync(source)) return;
    copyPath(source, join(prebuiltRoot, relativePath));
    copied.add(relativePath);
  };

  for (let layer of opts.plan.sourceLayers) {
    for (let inputPath of layer.inputPaths) {
      if (!existsSync(inputPath.absolutePath)) continue;
      if (!statSync(inputPath.absolutePath).isDirectory()) continue;

      for (let output of [
        'dist',
        'dist-worker',
        'frontend/dist',
        'generated',
        'prisma/generated',
        'src/generated'
      ]) {
        copyRelativePath(join(inputPath.relativeToContext, output).replace(/\\/g, '/'));
      }
    }
  }

  for (let artifact of opts.plan.artifacts) {
    if (artifact.from.startsWith('/') && !artifact.from.startsWith('//')) continue;

    if (!existsSync(resolve(opts.sourceRoot, artifact.fromRelativeToContext))) {
      throw new ControlError({
        code: 'prebuilt_artifact_missing',
        message: `Missing prebuilt artifact for ${opts.plan.service.name}: ${artifact.fromRelativeToContext}`,
        hint: 'Run the host build preparation before materializing a prebuilt Docker context'
      });
    }

    copyRelativePath(artifact.fromRelativeToContext);
  }
};

let materializeSourceInputs = async (opts: {
  plan: GeneratedBuildPlan;
  contextRoot: string;
  sourceRoot: string;
}) => {
  for (let layer of opts.plan.sourceLayers) {
    let inputPaths = new Set<string>(layer.inputPaths.map(path => path.relativeToContext));

    for (let file of rootInputFilesForPlan(opts.sourceRoot)) {
      inputPaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
    }

    await copyGitAwareSelection({
      sourceRoot: opts.sourceRoot,
      destRoot: join(opts.contextRoot, '_inputs', layer.name),
      includePaths: [...inputPaths].sort((a, b) => a.localeCompare(b))
    });
  }
};

let materializeNodeContext = async (opts: {
  plan: GeneratedBuildPlan;
  contextRoot: string;
  sourceRoot: string;
}): Promise<string> => {
  for (let i = 0; i < opts.plan.installLayers.length; i++) {
    let layer = opts.plan.installLayers[i]!;
    let manifestPaths = new Set<string>();

    for (let file of rootFilesForPlan(opts.sourceRoot)) {
      manifestPaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
    }

    for (let file of layer.manifestFiles) {
      manifestPaths.add(file.relativeToContext);
    }

    let layerRoot = join(opts.contextRoot, '_manifests', layer.name);
    await copyGitAwareSelection({
      sourceRoot: opts.sourceRoot,
      destRoot: layerRoot,
      includePaths: [...manifestPaths].sort((a, b) => a.localeCompare(b))
    });

    writeFileSync(
      join(layerRoot, 'package.json'),
      renderSyntheticWorkspacePackageJson({
        sourceRoot: opts.sourceRoot,
        manifestFiles: cumulativeManifestFiles(opts.plan.installLayers, i)
      })
    );

  }

  if (shouldUsePrebuiltBuildArtifacts()) {
    await materializeSourceInputs(opts);
    materializePrebuiltArtifacts(opts);
    return renderNodePrunedDockerfile(opts.plan);
  }

  await materializeSourceInputs(opts);

  return renderNodePrunedDockerfile(opts.plan);
};

let materializeDefaultContext = async (opts: {
  plan: GeneratedBuildPlan;
  contextRoot: string;
  sourceRoot: string;
  renderedDockerfile: string;
}) => {
  let includePaths = new Set<string>();

  for (let file of rootFilesForPlan(opts.sourceRoot)) {
    includePaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
  }

  for (let file of opts.plan.manifestFiles) {
    includePaths.add(file.relativeToContext);
  }

  for (let path of opts.plan.inputPaths) {
    includePaths.add(path.relativeToContext);
  }

  for (let file of rootInputFilesForPlan(opts.sourceRoot)) {
    includePaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
  }

  await copyGitAwareSelection({
    sourceRoot: opts.sourceRoot,
    destRoot: opts.contextRoot,
    includePaths: [...includePaths].sort((a, b) => a.localeCompare(b))
  });

  return opts.renderedDockerfile;
};

export let materializeBuildContext = async (opts: {
  plan: GeneratedBuildPlan;
  registry: ServiceRegistry;
  session?: WorkspaceSession | null;
  renderedDockerfile?: string;
}): Promise<MaterializedBuildContext> => {
  let renderedDockerfile = opts.renderedDockerfile ?? readFileSync(opts.plan.dockerfilePath, 'utf8');
  let contextRoot = resolve(
    opts.registry.controlRoot,
    '.control',
    'docker-context',
    sanitizeName(opts.plan.service.name)
  );

  rmSync(contextRoot, { recursive: true, force: true });
  mkdirSync(contextRoot, { recursive: true });
  let sourceRoot = shouldUsePrebuiltBuildArtifacts() ? opts.plan.contextRoot : resolveSourceRoot(opts);

  let dockerfileContent =
    opts.plan.builder === 'node'
      ? await materializeNodeContext({ plan: opts.plan, contextRoot, sourceRoot })
      : await materializeDefaultContext({
          plan: opts.plan,
          contextRoot,
          sourceRoot,
          renderedDockerfile
        });

  let dockerfileName = opts.plan.dockerfilePath.split('/').pop() ?? 'Dockerfile';
  let dockerfilePath = join(contextRoot, dockerfileName);
  writeFileSync(dockerfilePath, dockerfileContent);

  return { root: contextRoot, dockerfilePath };
};
