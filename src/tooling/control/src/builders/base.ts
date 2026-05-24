import { dirname, relative, resolve } from 'path';
import { ControlError } from '../errors';
import type {
  ControlBuildRuntime,
  ControlService,
  GeneratedBuildPlan,
  ServiceRegistry
} from '../types';
import {
  isDirectoryPath,
  resolveBuildArtifacts,
  resolveBuildContextRoot,
  resolveBuildPaths,
  resolveBuildSteps
} from './pathing';

export type BuildBuilder = {
  kind: 'node' | 'rust' | 'go';
  plan: (service: ControlService, registry: ServiceRegistry) => GeneratedBuildPlan | null;
  generateDockerfile: (plan: GeneratedBuildPlan) => string;
  generateNxMetadata?: (plan: GeneratedBuildPlan) => Record<string, unknown>;
  validate?: (plan: GeneratedBuildPlan) => void;
};

export let defaultRuntime = (
  runtime: ControlBuildRuntime | undefined,
  defaults: Required<ControlBuildRuntime>
): Required<ControlBuildRuntime> => ({
  base_image: runtime?.base_image ?? defaults.base_image,
  packages: runtime?.packages ?? defaults.packages,
  env: runtime?.env ?? defaults.env,
  expose: runtime?.expose ?? defaults.expose,
  command: runtime?.command ?? defaults.command,
  healthcheck: runtime?.healthcheck ?? defaults.healthcheck,
  user: runtime?.user ?? defaults.user,
  workdir: runtime?.workdir ?? defaults.workdir
});

export let defaultDockerfilePath = (service: ControlService, configured?: string): string =>
  resolve(service.dir, configured ?? 'Dockerfile.generated');

export let defaultWorkspaceRoot = (
  service: ControlService,
  contextRoot: string,
  configured?: string
): string =>
  configured ?? `/app/${relative(contextRoot, service.dir).replace(/\\/g, '/')}`;

export let createBasePlan = (opts: {
  service: ControlService;
  registry: ServiceRegistry;
  builder: 'node' | 'rust' | 'go';
  runtime: Required<ControlBuildRuntime>;
}): GeneratedBuildPlan | null => {
  let build = opts.service.config.build;
  if (!build) return null;

  let context = resolveBuildContextRoot(opts.service, opts.registry, build);
  let dockerfilePath = defaultDockerfilePath(opts.service, build.dockerfile);
  let workspaceRoot = defaultWorkspaceRoot(opts.service, context.root, build.workspace_root);
  let manifests = resolveBuildPaths({
    service: opts.service,
    registry: opts.registry,
    contextRoot: context.root,
    patterns: build.manifests?.files,
    label: 'manifest'
  });
  let inputs = resolveBuildPaths({
    service: opts.service,
    registry: opts.registry,
    contextRoot: context.root,
    patterns: [
      ...(build.inputs?.paths ?? []),
      ...(build.inputs?.include_paths ?? []),
      ...(build.inputs?.generated_paths ?? [])
    ],
    label: 'input'
  });

  let plan: GeneratedBuildPlan = {
    builder: opts.builder,
    service: opts.service,
    mode: build.mode ?? 'generated',
    contextKind: context.kind,
    contextRoot: context.root,
    dockerfilePath,
    workspaceRoot,
    manifestFiles: manifests,
    inputPaths: inputs,
    automations: [],
    codegenSteps: resolveBuildSteps({
      service: opts.service,
      registry: opts.registry,
      contextRoot: context.root,
      steps: build.codegen?.steps
    }),
    prebuildSteps: resolveBuildSteps({
      service: opts.service,
      registry: opts.registry,
      contextRoot: context.root,
      steps: build.prebuild?.steps
    }),
    mainSteps: resolveBuildSteps({
      service: opts.service,
      registry: opts.registry,
      contextRoot: context.root,
      steps: build.main?.steps
    }),
    artifacts: resolveBuildArtifacts({
      service: opts.service,
      registry: opts.registry,
      contextRoot: context.root,
      artifacts: build.artifacts?.copy
    }),
    runtime: opts.runtime,
    project: build.project,
    target: build.target,
    serviceDockerfile: opts.service.config.service?.dockerfile
  };

  return plan;
};

export let formatContainerPath = (relPath: string): string => {
  if (relPath === '.') return '/app';
  return `/app/${relPath.replace(/\\/g, '/')}`;
};

export let formatContainerWorkdir = (relPath: string): string => formatContainerPath(relPath);

export let formatRunStep = (run: string): string => run.replace(/\n+/g, ' ').trim();

export let renderCopyLines = (paths: { relativeToContext: string; absolutePath: string }[]): string[] => {
  let lines: string[] = [];

  for (let path of paths) {
    let from = path.relativeToContext.replace(/^\.\//, '');
    if (!from || from === '.') continue;
    let to = dirname(from).replace(/\\/g, '/');
    let target = to === '.' ? './' : `./${to}/`;
    lines.push(`COPY ${from} ${target}`);
  }

  return lines;
};

export let renderArtifactLines = (plan: GeneratedBuildPlan): string[] => {
  let lines: string[] = [];

  for (let artifact of plan.artifacts) {
    let from = artifact.from.startsWith('/') && !artifact.from.startsWith('//')
      ? artifact.from
      : formatContainerPath(artifact.fromRelativeToContext);
    lines.push(`COPY --from=build ${from} ${artifact.to}`);
  }

  return lines;
};

export let buildCommandForPlan = (plan: GeneratedBuildPlan): string => {
  if (plan.project && plan.target) {
    return `bun x nx run ${plan.project}:${plan.target}`;
  }

  if (plan.mainSteps.length === 1) {
    return formatRunStep(plan.mainSteps[0]!.run);
  }

  if (plan.mainSteps.length > 1) {
    return plan.mainSteps.map(step => formatRunStep(step.run)).join(' && ');
  }

  throw new ControlError({
    code: 'build_missing_main_step',
    message: `Service "${plan.service.name}" is missing a build target or main build steps`,
    hint: 'Set [build].target or add [build.main].steps'
  });
};

export let assertArtifactsConfigured = (plan: GeneratedBuildPlan) => {
  if (plan.artifacts.length > 0) return;
  throw new ControlError({
    code: 'build_missing_artifacts',
    message: `Service "${plan.service.name}" has no [build.artifacts] copy rules`,
    hint: 'Add [build.artifacts.copy] entries so the generated runner image can be assembled'
  });
};

export let assertRuntimeCommand = (plan: GeneratedBuildPlan) => {
  if (plan.runtime.command) return;
  throw new ControlError({
    code: 'build_missing_runtime_command',
    message: `Service "${plan.service.name}" is missing [build.runtime].command`
  });
};

export let assertHasMainInputs = (plan: GeneratedBuildPlan) => {
  if (plan.manifestFiles.length === 0 && plan.inputPaths.length === 0) {
    throw new ControlError({
      code: 'build_missing_inputs',
      message: `Service "${plan.service.name}" has no manifests or inputs configured`
    });
  }
};

export let maybeDirectoryInputs = (plan: GeneratedBuildPlan) =>
  plan.inputPaths.filter(path => isDirectoryPath(path.absolutePath));
