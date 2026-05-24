import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { ControlError } from '../errors';
import { copyGitAwareSelection } from '../staging/copyTree';
import type { GeneratedBuildPlan, ServiceRegistry, WorkspaceSession } from '../types';
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
  plan: GeneratedBuildPlan;
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

  for (let manifest of opts.plan.manifestFiles) {
    let dir = dirname(manifest.relativeToContext).replace(/\\/g, '/');
    if (!dir || dir === '.') continue;
    workspaces.add(dir);
  }

  base.workspaces = [...workspaces].sort((a, b) => a.localeCompare(b));

  return `${JSON.stringify(base, null, 2)}\n`;
};

let materializeNodeContext = async (opts: {
  plan: GeneratedBuildPlan;
  contextRoot: string;
  sourceRoot: string;
}): Promise<string> => {
  let manifestPaths = new Set<string>();

  for (let file of rootFilesForPlan(opts.sourceRoot)) {
    manifestPaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
  }

  for (let file of opts.plan.manifestFiles) {
    manifestPaths.add(file.relativeToContext);
  }

  let inputPaths = new Set<string>(opts.plan.inputPaths.map(path => path.relativeToContext));
  for (let file of rootInputFilesForPlan(opts.sourceRoot)) {
    inputPaths.add(resolveRelativeToRoot(opts.sourceRoot, file));
  }

  await copyGitAwareSelection({
    sourceRoot: opts.sourceRoot,
    destRoot: join(opts.contextRoot, '_manifests'),
    includePaths: [...manifestPaths].sort((a, b) => a.localeCompare(b))
  });

  writeFileSync(
    join(opts.contextRoot, '_manifests', 'package.json'),
    renderSyntheticWorkspacePackageJson(opts)
  );

  await copyGitAwareSelection({
    sourceRoot: opts.sourceRoot,
    destRoot: join(opts.contextRoot, '_inputs'),
    includePaths: [...inputPaths].sort((a, b) => a.localeCompare(b))
  });

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
  let sourceRoot = resolveSourceRoot(opts);

  let dockerfileContent =
    opts.plan.builder === 'node'
      ? await materializeNodeContext({ plan: opts.plan, contextRoot, sourceRoot })
      : await materializeDefaultContext({
          plan: opts.plan,
          contextRoot,
          sourceRoot,
          renderedDockerfile
        });

  let dockerfileName = opts.plan.dockerfilePath.split('/').pop() ?? 'Dockerfile.generated';
  let dockerfilePath = join(contextRoot, dockerfileName);
  writeFileSync(dockerfilePath, dockerfileContent);

  return { root: contextRoot, dockerfilePath };
};
