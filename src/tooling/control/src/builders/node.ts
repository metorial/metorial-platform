import { existsSync } from 'fs';
import { resolve } from 'path';
import type { BuildBuilder } from './base';
import {
  assertArtifactsConfigured,
  assertRuntimeCommand,
  createBasePlan,
  defaultRuntime,
  renderApkInstall,
  renderAptInstall,
  renderArtifactLines
} from './base';
import {
  collectNxDependents,
  collectNxProjectClosure,
  getNxProjectRoot,
  readNxProjectGraph,
  renderNxRunManyCommand
} from './nx';
import { resolveBuildPaths } from './pathing';
import { ControlError } from '../errors';
import type {
  ControlBuildAutomation,
  GeneratedBuildAutomation,
  GeneratedBuildInstallLayer,
  GeneratedBuildPath,
  GeneratedBuildPlan,
  ServiceRegistry
} from '../types';

let defaultNodeRuntime = defaultRuntime(undefined, {
  base_image: 'oven/bun:1.2-alpine',
  packages: [],
  env: {},
  expose: [],
  command: '',
  healthcheck: '',
  user: '',
  workdir: '/app'
});

let renderEnvLines = (plan: GeneratedBuildPlan): string[] => {
  let entries = Object.entries(plan.runtime.env);
  if (entries.length === 0) return [];
  return entries.map(([key, value]) => `ENV ${key}=${JSON.stringify(value)}`);
};

let renderRuntimePackages = (plan: GeneratedBuildPlan): string[] => renderApkInstall(plan.runtime.packages);

let renderHealthcheckLines = (plan: GeneratedBuildPlan): string[] =>
  plan.runtime.healthcheck
    ? [
        'HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\',
        `  CMD ${plan.runtime.healthcheck}`
      ]
    : [];

let projectPackageJsonPath = (plan: GeneratedBuildPlan, projectRoot: string): GeneratedBuildPath | null => {
  let absolutePath = resolve(plan.contextRoot, projectRoot, 'package.json');
  if (!existsSync(absolutePath)) return null;

  return {
    pattern: `${projectRoot}/package.json`,
    absolutePath,
    relativeToService: projectRoot,
    relativeToContext: `${projectRoot}/package.json`.replace(/\\/g, '/'),
    exists: true
  };
};

let projectRootPath = (plan: GeneratedBuildPlan, projectRoot: string): GeneratedBuildPath => ({
  pattern: projectRoot,
  absolutePath: resolve(plan.contextRoot, projectRoot),
  relativeToService: projectRoot,
  relativeToContext: projectRoot.replace(/\\/g, '/'),
  exists: true
});

let resolveAutomationProjects = (opts: {
  plan: GeneratedBuildPlan;
  automation: ControlBuildAutomation;
  graph: ReturnType<typeof readNxProjectGraph>;
}): string[] => {
  if (opts.automation.kind === 'run-targets') {
    return [...opts.automation.projects].sort((a, b) => a.localeCompare(b));
  }

  return collectNxDependents({
    graph: opts.graph,
    seeds: opts.automation.projects,
    projectFilter: opts.automation.project_filter
  });
};

let renderAutomationCommand = (automation: GeneratedBuildAutomation): string => automation.command;

let renderNxRun = (command: string): string =>
  `RUN --mount=type=cache,target=/app/.nx/cache cd /app && ${command}`;

let collectNodeProjectUseCounts = (opts: {
  registry: ServiceRegistry;
  graph: ReturnType<typeof readNxProjectGraph>;
  contextRoot: string;
}): Map<string, number> => {
  let counts = new Map<string, number>();

  for (let service of opts.registry.services) {
    let build = service.config.build;
    if (build?.builder !== 'node' || !build.project) continue;

    let servicePlan = createBasePlan({
      service,
      registry: opts.registry,
      builder: 'node',
      runtime: defaultNodeRuntime
    });
    if (!servicePlan || servicePlan.contextRoot !== opts.contextRoot) continue;

    let serviceProjects = new Set<string>();

    for (let project of collectNxProjectClosure(opts.graph, [build.project])) {
      serviceProjects.add(project);
    }

    for (let automation of build.automations ?? []) {
      let automationProjects = resolveAutomationProjects({
        plan: servicePlan,
        automation,
        graph: opts.graph
      });
      for (let project of collectNxProjectClosure(opts.graph, automationProjects)) {
        serviceProjects.add(project);
      }
    }

    for (let project of serviceProjects) {
      counts.set(project, (counts.get(project) ?? 0) + 1);
    }
  }

  return counts;
};

let projectManifestFiles = (
  plan: GeneratedBuildPlan,
  graph: ReturnType<typeof readNxProjectGraph>,
  projects: Iterable<string>
): GeneratedBuildPath[] =>
  [...projects]
    .sort((a, b) => a.localeCompare(b))
    .map(project => projectPackageJsonPath(plan, getNxProjectRoot(graph, project)))
    .filter((path): path is GeneratedBuildPath => !!path);

let internalDependenciesOf = (
  graph: ReturnType<typeof readNxProjectGraph>,
  project: string
): string[] =>
  (graph.dependencies[project] ?? [])
    .map(dep => dep.target)
    .filter(target => !!graph.nodes[target]);

let closeInstallLayerOrder = (opts: {
  graph: ReturnType<typeof readNxProjectGraph>;
  includedProjects: Set<string>;
  baseProjects: Set<string>;
  dependencyProjects: Set<string>;
  serviceProjects: Set<string>;
}) => {
  let changed = true;

  while (changed) {
    changed = false;

    for (let project of [...opts.baseProjects]) {
      let deps = internalDependenciesOf(opts.graph, project).filter(dep =>
        opts.includedProjects.has(dep)
      );

      if (deps.some(dep => !opts.baseProjects.has(dep))) {
        opts.baseProjects.delete(project);
        opts.dependencyProjects.add(project);
        changed = true;
      }
    }

    for (let project of [...opts.dependencyProjects]) {
      let deps = internalDependenciesOf(opts.graph, project).filter(dep =>
        opts.includedProjects.has(dep)
      );

      if (deps.some(dep => !opts.baseProjects.has(dep) && !opts.dependencyProjects.has(dep))) {
        opts.dependencyProjects.delete(project);
        opts.serviceProjects.add(project);
        changed = true;
      }
    }
  }
};

let createNodeInstallLayers = (opts: {
  plan: GeneratedBuildPlan;
  graph: ReturnType<typeof readNxProjectGraph>;
  registry: ServiceRegistry;
  includedProjects: Set<string>;
  serviceProjects: Set<string>;
  installLinker: string;
}): GeneratedBuildInstallLayer[] => {
  let useCounts = collectNodeProjectUseCounts({
    registry: opts.registry,
    graph: opts.graph,
    contextRoot: opts.plan.contextRoot
  });
  let baseProjects = new Set<string>();
  let dependencyProjects = new Set<string>();
  let serviceProjects = new Set<string>();

  for (let project of opts.includedProjects) {
    if (opts.serviceProjects.has(project)) {
      serviceProjects.add(project);
      continue;
    }
    if ((useCounts.get(project) ?? 0) > 1) {
      baseProjects.add(project);
      continue;
    }
    dependencyProjects.add(project);
  }

  closeInstallLayerOrder({
    graph: opts.graph,
    includedProjects: opts.includedProjects,
    baseProjects,
    dependencyProjects,
    serviceProjects
  });

  let command = `bun install --linker=${opts.installLinker}`;

  return [
    {
      name: 'base',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, baseProjects)
    },
    {
      name: 'dependencies',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, dependencyProjects)
    },
    {
      name: 'service',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, serviceProjects)
    }
  ].filter(layer => layer.manifestFiles.length > 0);
};

export let renderNodePrunedDockerfile = (plan: GeneratedBuildPlan): string => {
  let installLinker = plan.service.config.build?.install?.linker ?? 'hoisted';
  let systemPackages = plan.service.config.build?.install?.system_packages ?? ['ca-certificates'];
  let automationLines = plan.automations.map(automation => renderAutomationCommand(automation));
  let artifactLines = renderArtifactLines(plan);
  let exposeLines = plan.runtime.expose.map(port => `EXPOSE ${port}`);

  let lines = [
    '# syntax=docker/dockerfile:1.7',
    '# generated by control bootstrap',
    'FROM oven/bun:1.2 AS deps',
    'WORKDIR /app',
    'ENV NX_CACHE_DIRECTORY=/app/.nx/cache',
    ...renderAptInstall(systemPackages),
    ...plan.installLayers.flatMap(layer => [
      `COPY _manifests/${layer.name}/ ./`,
      `RUN --mount=type=cache,id=control-bun-install,target=/root/.bun/install/cache,sharing=locked ${layer.command}`
    ]),
    '',
    'FROM deps AS build',
    'WORKDIR /app',
    'COPY _inputs/ ./',
    ...automationLines.map(renderNxRun),
    renderNxRun(`bun x nx run ${plan.project}:${plan.target}`),
    '',
    'FROM build AS workspace',
    `WORKDIR ${plan.workspaceRoot}`,
    'CMD ["sleep", "infinity"]',
    '',
    `FROM ${plan.runtime.base_image} AS runner`,
    `WORKDIR ${plan.runtime.workdir}`,
    ...renderRuntimePackages(plan),
    ...artifactLines,
    ...renderEnvLines(plan),
    ...exposeLines,
    ...renderHealthcheckLines(plan),
    `CMD ["sh", "-c", ${JSON.stringify(plan.runtime.command)}]`
  ];

  return lines.filter(Boolean).join('\n') + '\n';
};

export let nodeBuildBuilder: BuildBuilder = {
  kind: 'node',
  plan: (service, registry) => {
    if (service.config.build?.builder !== 'node') return null;

    let runtime = defaultRuntime(service.config.build.runtime, defaultNodeRuntime);
    let plan = createBasePlan({
      service,
      registry,
      builder: 'node',
      runtime
    });
    if (!plan) return null;

    let build = service.config.build;
    if (!build?.project || !build.target) {
      throw new ControlError({
        code: 'node_build_missing_project_target',
        message: `Node service "${service.name}" must declare [build].project and [build].target`
      });
    }

    if (build.manifests?.files?.length || build.inputs?.paths?.length || build.inputs?.include_paths?.length || build.inputs?.generated_paths?.length) {
      throw new ControlError({
        code: 'node_build_legacy_paths_not_supported',
        message: `Node service "${service.name}" still uses legacy [build.manifests] or [build.inputs] path configuration`,
        hint: 'Patch control.toml to use build.project/build.target/build.automations/build.extra_paths'
      });
    }

    if (build.codegen?.steps?.length || build.prebuild?.steps?.length || build.main?.steps?.length) {
      throw new ControlError({
        code: 'node_build_legacy_steps_not_supported',
        message: `Node service "${service.name}" still uses legacy [build.codegen], [build.prebuild], or [build.main] steps`,
        hint: 'Move Node build prerequisites into build.automations and keep the main build in build.target'
      });
    }

    let graph = readNxProjectGraph(plan.contextRoot);
    let mainClosure = collectNxProjectClosure(graph, [build.project]);
    let includedProjects = new Set<string>(mainClosure);
    let serviceProjects = new Set<string>([build.project]);
    let resolvedAutomations: GeneratedBuildAutomation[] = [];

    for (let automation of build.automations ?? []) {
      let projects = resolveAutomationProjects({ plan, automation, graph });
      for (let project of projects) {
        serviceProjects.add(project);
      }
      for (let project of collectNxProjectClosure(graph, projects)) {
        includedProjects.add(project);
      }
      resolvedAutomations.push({
        name: automation.name,
        kind: automation.kind,
        target: automation.target,
        projects,
        command: renderNxRunManyCommand({ target: automation.target, projects })
      });
    }

    let inputPaths = [...includedProjects]
      .sort((a, b) => a.localeCompare(b))
      .map(project => projectRootPath(plan, getNxProjectRoot(graph, project)));

    let extraPaths = resolveBuildPaths({
      service,
      registry,
      contextRoot: plan.contextRoot,
      patterns: build.extra_paths,
      label: 'extra path'
    });

    for (let extraPath of extraPaths) {
      inputPaths.push(extraPath);
    }

    plan.project = build.project;
    plan.target = build.target;
    plan.installLayers = createNodeInstallLayers({
      plan,
      graph,
      registry,
      includedProjects,
      serviceProjects,
      installLinker: build.install?.linker ?? 'hoisted'
    });
    plan.manifestFiles = plan.installLayers
      .flatMap(layer => layer.manifestFiles)
      .sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
    plan.inputPaths = inputPaths.sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
    plan.automations = resolvedAutomations;
    plan.codegenSteps = [];
    plan.prebuildSteps = [];
    plan.mainSteps = [];

    return plan;
  },
  generateDockerfile: plan => renderNodePrunedDockerfile(plan),
  validate: plan => {
    if (!plan.project || !plan.target) {
      throw new ControlError({
        code: 'node_build_missing_project_target',
        message: `Node service "${plan.service.name}" must declare build.project and build.target`
      });
    }
    if (plan.inputPaths.length === 0) {
      throw new ControlError({
        code: 'node_build_missing_projects',
        message: `Node service "${plan.service.name}" resolved to an empty Nx build closure`
      });
    }
    assertArtifactsConfigured(plan);
    assertRuntimeCommand(plan);
  }
};
