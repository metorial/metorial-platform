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
  nxProjectHasTarget,
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
  GeneratedBuildSourceLayer,
  ServiceRegistry
} from '../types';

let defaultNodeRuntime = defaultRuntime(undefined, {
  base_image: 'oven/bun:1.2.22-alpine',
  packages: [],
  env: {},
  expose: [],
  command: '',
  healthcheck: '',
  user: '',
  workdir: '/app'
});

let nodeBuildImage = 'oven/bun:1.2.22';

let pinBunImage = (image: string): string => {
  if (image === 'oven/bun:1.2') return 'oven/bun:1.2.22';
  if (image === 'oven/bun:1.2-alpine') return 'oven/bun:1.2.22-alpine';
  return image;
};

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

let existingContextPath = (
  plan: GeneratedBuildPlan,
  relativePath: string
): GeneratedBuildPath | null => {
  let normalized = relativePath.replace(/\\/g, '/');
  let absolutePath = resolve(plan.contextRoot, normalized);
  if (!existsSync(absolutePath)) return null;

  return {
    pattern: normalized,
    absolutePath,
    relativeToService: normalized,
    relativeToContext: normalized,
    exists: true
  };
};

let isClientProject = (
  graph: ReturnType<typeof readNxProjectGraph>,
  project: string
): boolean => getNxProjectRoot(graph, project).startsWith('src/systems/_clients/');

let collectServiceBuildProjects = (registry: ServiceRegistry): Set<string> => {
  let projects = new Set<string>();

  for (let service of registry.services) {
    let build = service.config.build;
    if (build?.builder !== 'node') continue;
    if (build.project) projects.add(build.project);
  }

  return projects;
};

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

let shouldRetryNxRun = (command: string): boolean =>
  command.includes('--target=prisma:generate') || /:prisma:generate(\s|$)/.test(command);

let renderRetriableCommand = (command: string): string =>
  `{ attempt=1; until ${command}; do code=$?; if [ "$attempt" -ge 3 ]; then exit "$code"; fi; sleep $((attempt * 2)); attempt=$((attempt + 1)); done; }`;

let renderNxRun = (command: string): string =>
  `RUN --mount=type=cache,id=control-nx-cache,target=/app/.nx/cache,sharing=locked cd /app && ${shouldRetryNxRun(command) ? renderRetriableCommand(command) : command}`;

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
  installLinker?: string;
}): GeneratedBuildInstallLayer[] => {
  let useCounts = collectNodeProjectUseCounts({
    registry: opts.registry,
    graph: opts.graph,
    contextRoot: opts.plan.contextRoot
  });
  let serviceBuildProjects = collectServiceBuildProjects(opts.registry);
  let baseProjects = new Set<string>();
  let clientProjects = new Set<string>();
  let dependencyProjects = new Set<string>();
  let serviceProjects = new Set<string>();

  for (let [project, count] of useCounts) {
    if (count <= 1) continue;
    if (serviceBuildProjects.has(project)) continue;
    baseProjects.add(project);
  }

  for (let project of [...baseProjects]) {
    for (let dep of collectNxProjectClosure(opts.graph, [project])) {
      baseProjects.add(dep);
    }
  }

  for (let project of opts.includedProjects) {
    if (baseProjects.has(project)) continue;
    if (opts.serviceProjects.has(project)) {
      serviceProjects.add(project);
      continue;
    }
    if (isClientProject(opts.graph, project)) {
      clientProjects.add(project);
      continue;
    }
    dependencyProjects.add(project);
  }

  for (let project of [...clientProjects]) {
    for (let dep of collectNxProjectClosure(opts.graph, [project])) {
      if (baseProjects.has(dep)) continue;
      clientProjects.add(dep);
    }
  }

  closeInstallLayerOrder({
    graph: opts.graph,
    includedProjects: opts.includedProjects,
    baseProjects,
    dependencyProjects: clientProjects,
    serviceProjects: dependencyProjects
  });
  closeInstallLayerOrder({
    graph: opts.graph,
    includedProjects: opts.includedProjects,
    baseProjects: new Set([...baseProjects, ...clientProjects]),
    dependencyProjects,
    serviceProjects
  });

  let command = opts.installLinker ? `bun install --linker=${opts.installLinker}` : 'bun install';

  return ([
    {
      name: 'base',
      tier: 'shared',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, baseProjects)
    },
    {
      name: 'clients',
      tier: 'clients',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, clientProjects)
    },
    {
      name: 'dependencies',
      tier: 'dependencies',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, dependencyProjects)
    },
    {
      name: 'service',
      tier: 'service',
      tool: 'bun',
      command,
      manifestFiles: projectManifestFiles(opts.plan, opts.graph, serviceProjects)
    }
  ] satisfies GeneratedBuildInstallLayer[]).filter(layer => layer.manifestFiles.length > 0);
};

let createSourceLayers = (opts: {
  plan: GeneratedBuildPlan;
  graph: ReturnType<typeof readNxProjectGraph>;
  serviceBuildProjects: Set<string>;
  projectsByTier: {
    shared: Set<string>;
    clients: Set<string>;
    dependencies: Set<string>;
    service: Set<string>;
  };
  extraPaths: GeneratedBuildPath[];
}): GeneratedBuildSourceLayer[] => {
  let projectPaths = (projects: Set<string>) =>
    [...projects]
      .sort((a, b) => a.localeCompare(b))
      .map(project => projectRootPath(opts.plan, getNxProjectRoot(opts.graph, project)));

  let clientInterfacePaths = () => {
    let paths = new Map<string, GeneratedBuildPath>();
    let addPath = (path: GeneratedBuildPath | null) => {
      if (path) paths.set(path.relativeToContext, path);
    };

    for (let clientProject of opts.projectsByTier.clients) {
      for (let dependency of collectNxProjectClosure(opts.graph, [clientProject])) {
        if (!opts.serviceBuildProjects.has(dependency)) continue;

        let root = getNxProjectRoot(opts.graph, dependency);
        for (let relativePath of [
          `${root}/src/apis`,
          `${root}/src/controllers`,
          `${root}/src/presenters`,
          `${root}/src/db`,
          `${root}/db`,
          `${root}/prisma`,
          `${root}/prisma.config.ts`
        ]) {
          addPath(existingContextPath(opts.plan, relativePath));
        }

        if (root.endsWith('/service')) {
          addPath(existingContextPath(opts.plan, `${root.slice(0, -'/service'.length)}/db`));
        }
      }
    }

    return [...paths.values()].sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
  };

  let layers: GeneratedBuildSourceLayer[] = [
    {
      name: 'shared',
      tier: 'shared',
      projects: [...opts.projectsByTier.shared].sort((a, b) => a.localeCompare(b)),
      inputPaths: projectPaths(opts.projectsByTier.shared),
      commands: []
    },
    {
      name: 'clients',
      tier: 'clients',
      projects: [...opts.projectsByTier.clients].sort((a, b) => a.localeCompare(b)),
      inputPaths: [...projectPaths(opts.projectsByTier.clients), ...clientInterfacePaths()],
      commands: []
    },
    {
      name: 'dependencies',
      tier: 'dependencies',
      projects: [...opts.projectsByTier.dependencies].sort((a, b) => a.localeCompare(b)),
      inputPaths: projectPaths(opts.projectsByTier.dependencies),
      commands: []
    },
    {
      name: 'service',
      tier: 'service',
      projects: [...opts.projectsByTier.service].sort((a, b) => a.localeCompare(b)),
      inputPaths: [...projectPaths(opts.projectsByTier.service), ...opts.extraPaths],
      commands: []
    }
  ];

  let emittedLayers = layers.filter(layer => layer.inputPaths.length > 0);
  let clientWarmLayer =
    emittedLayers.find(layer => layer.tier === 'dependencies') ??
    emittedLayers.find(layer => layer.tier === 'clients');
  let projectsAvailableForClientWarm = new Set([
    ...opts.projectsByTier.shared,
    ...opts.projectsByTier.clients,
    ...(clientWarmLayer?.tier === 'dependencies' ? opts.projectsByTier.dependencies : [])
  ]);
  let clientPrismaWarmCommands = clientWarmLayer
    ? clientPrismaWarmCommandsForProjects(opts.graph, opts.projectsByTier.clients, projectsAvailableForClientWarm)
    : [];
  let clientWarmCommands = clientWarmLayer
    ? clientBuildWarmCommands(opts.graph, opts.projectsByTier.clients)
    : [];

  return emittedLayers.map(layer => ({
    ...layer,
    commands: [
      ...sourceLayerWarmCommands(opts.graph, layer),
      ...(layer === clientWarmLayer ? clientPrismaWarmCommands : []),
      ...(layer === clientWarmLayer ? clientWarmCommands : [])
    ]
  }));
};

let sourceLayerWarmCommands = (
  graph: ReturnType<typeof readNxProjectGraph>,
  layer: GeneratedBuildSourceLayer
): string[] => {
  if (layer.tier === 'clients' || layer.tier === 'service') return [];

  let buildableProjects = layer.projects.filter(project =>
    nxProjectHasTarget(graph, project, 'build')
  );
  if (buildableProjects.length === 0) return [];

  return [
    renderNxRunManyCommand({
      target: 'build',
      projects: buildableProjects.sort((a, b) => a.localeCompare(b))
    })
  ];
};

let clientBuildWarmCommands = (
  graph: ReturnType<typeof readNxProjectGraph>,
  projects: Set<string>
): string[] => {
  let buildableProjects = [...projects]
    .filter(project => nxProjectHasTarget(graph, project, 'build'))
    .sort((a, b) => a.localeCompare(b));
  if (buildableProjects.length === 0) return [];

  return [
    renderNxRunManyCommand({
      target: 'build',
      projects: buildableProjects
    })
  ];
};

let clientPrismaWarmCommandsForProjects = (
  graph: ReturnType<typeof readNxProjectGraph>,
  clientProjects: Set<string>,
  availableProjects: Set<string>
): string[] => {
  let prismaProjects = new Set<string>();

  for (let clientProject of clientProjects) {
    for (let project of collectNxProjectClosure(graph, [clientProject])) {
      if (!availableProjects.has(project)) continue;
      if (!nxProjectHasTarget(graph, project, 'prisma:generate')) continue;
      prismaProjects.add(project);
    }
  }

  let projects = [...prismaProjects].sort((a, b) => a.localeCompare(b));
  if (projects.length === 0) return [];

  return [
    renderNxRunManyCommand({
      target: 'prisma:generate',
      projects
    })
  ];
};

let projectsForManifestLayer = (
  graph: ReturnType<typeof readNxProjectGraph>,
  projects: Iterable<string>,
  layer: GeneratedBuildInstallLayer | undefined
): Set<string> => {
  let manifestPaths = new Set(
    (layer?.manifestFiles ?? []).map(file => file.relativeToContext)
  );
  let matched = new Set<string>();

  for (let project of projects) {
    let manifestPath = `${getNxProjectRoot(graph, project)}/package.json`;
    if (manifestPaths.has(manifestPath)) matched.add(project);
  }

  return matched;
};

export let renderNodePrunedDockerfile = (plan: GeneratedBuildPlan): string => {
  let systemPackages = plan.service.config.build?.install?.system_packages ?? ['ca-certificates'];
  let automationLines = plan.automations.map(automation => renderAutomationCommand(automation));
  let sourceLayerLines = plan.sourceLayers.flatMap(layer => [
    `COPY _inputs/${layer.name}/ ./`,
    ...layer.commands.map(renderNxRun)
  ]);
  let artifactLines = renderArtifactLines(plan);
  let exposeLines = plan.runtime.expose.map(port => `EXPOSE ${port}`);

  let lines = [
    '# syntax=docker/dockerfile:1.7',
    '# generated by control bootstrap',
    `FROM ${nodeBuildImage} AS deps`,
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
    ...sourceLayerLines,
    ...automationLines.map(renderNxRun),
    renderNxRun(`bun x nx run ${plan.project}:${plan.target}`),
    '',
    'FROM build AS workspace',
    `WORKDIR ${plan.workspaceRoot}`,
    'CMD ["sleep", "infinity"]',
    '',
    `FROM ${pinBunImage(plan.runtime.base_image)} AS runner`,
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

    let extraPaths = resolveBuildPaths({
      service,
      registry,
      contextRoot: plan.contextRoot,
      patterns: build.extra_paths,
      label: 'extra path'
    });

    plan.project = build.project;
    plan.target = build.target;
    plan.installLayers = createNodeInstallLayers({
      plan,
      graph,
      registry,
      includedProjects,
      serviceProjects,
      installLinker: build.install?.linker
    });
    let serviceBuildProjects = collectServiceBuildProjects(registry);
    let installLayerByName = new Map(plan.installLayers.map(layer => [layer.name, layer]));
    let projectsByTier = {
      shared: projectsForManifestLayer(graph, includedProjects, installLayerByName.get('base')),
      clients: projectsForManifestLayer(graph, includedProjects, installLayerByName.get('clients')),
      dependencies: projectsForManifestLayer(
        graph,
        includedProjects,
        installLayerByName.get('dependencies')
      ),
      service: projectsForManifestLayer(graph, includedProjects, installLayerByName.get('service'))
    };
    for (let project of [...projectsByTier.shared]) {
      if (!serviceBuildProjects.has(project) && !isClientProject(graph, project)) continue;
      projectsByTier.shared.delete(project);
      if (isClientProject(graph, project)) {
        projectsByTier.clients.add(project);
      } else if (serviceProjects.has(project)) {
        projectsByTier.service.add(project);
      } else {
        projectsByTier.dependencies.add(project);
      }
    }
    for (let project of [...projectsByTier.clients]) {
      if (isClientProject(graph, project)) continue;
      projectsByTier.clients.delete(project);
      if (serviceProjects.has(project)) {
        projectsByTier.service.add(project);
      } else {
        projectsByTier.dependencies.add(project);
      }
    }
    for (let project of includedProjects) {
      if (
        projectsByTier.shared.has(project) ||
        projectsByTier.clients.has(project) ||
        projectsByTier.dependencies.has(project) ||
        projectsByTier.service.has(project)
      ) {
        continue;
      }
      projectsByTier.service.add(project);
    }
    plan.sourceLayers = createSourceLayers({
      plan,
      graph,
      serviceBuildProjects,
      projectsByTier,
      extraPaths
    });
    plan.manifestFiles = plan.installLayers
      .flatMap(layer => layer.manifestFiles)
      .sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
    plan.inputPaths = plan.sourceLayers
      .flatMap(layer => layer.inputPaths)
      .sort((a, b) => a.relativeToContext.localeCompare(b.relativeToContext));
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
