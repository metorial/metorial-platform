import { relative, resolve } from 'path';
import type { ResolvedDep, ResolvedGraph } from '../types';

export type DockerBuildConfig = {
  context: string;
  dockerfile: string;
  target: string;
  args?: Record<string, string>;
  extra_hosts?: string[];
};

export type DockerBuildSpec = DockerBuildConfig & {
  name: string;
};

export let resolveBuild = (
  graph: ResolvedGraph,
  opts?: { role: 'test-runner' | 'service' }
): DockerBuildConfig => {
  let svc = graph.config.service!;
  let usesGeneratedDockerfile = !!(graph.config.build?.mode && graph.config.build.mode !== 'custom');
  let generatedDockerfile = usesGeneratedDockerfile
    ? graph.config.build?.dockerfile ?? 'Dockerfile'
    : undefined;
  let dockerfile = generatedDockerfile ?? svc.dockerfile ?? 'Dockerfile';
  let target = svc.docker_target ?? (opts?.role === 'test-runner' ? 'workspace' : 'runner');
  let normalizeDockerfile = (context: string): string => {
    if (!usesGeneratedDockerfile) {
      return dockerfile.startsWith('./') ? dockerfile : `./${dockerfile.replace(/^\.\//, '')}`;
    }

    let absoluteDockerfile = resolve(graph.dir, dockerfile);
    let relativeDockerfile = relative(context, absoluteDockerfile).replace(/\\/g, '/');
    return relativeDockerfile.startsWith('.') ? relativeDockerfile : `./${relativeDockerfile}`;
  };

  if (graph.config.build?.context === 'repo') {
    return {
      context: graph.entrypoint,
      dockerfile: normalizeDockerfile(graph.entrypoint),
      target
    };
  }

  if (svc.build_context === 'oss') {
    return {
      context: graph.ossRoot,
      dockerfile: normalizeDockerfile(graph.ossRoot),
      target
    };
  }

  let context = resolve(graph.dir, svc.build_context ?? '.');
  return { context, dockerfile, target };
};

let buildKey = (build: DockerBuildConfig) =>
  `${build.context}::${build.dockerfile}::${build.target}`;

let addRunnerBuild = (
  specs: Map<string, DockerBuildSpec>,
  name: string,
  graph: ResolvedGraph
) => {
  if (!graph.config.service) return;

  let build = resolveBuild(graph, { role: 'service' });
  let key = buildKey(build);
  if (!specs.has(key)) {
    specs.set(key, { name, ...build });
  }
};

let collectControlRunnerBuilds = (
  specs: Map<string, DockerBuildSpec>,
  dep: ResolvedDep
) => {
  if (dep.kind !== 'control' || !dep.children) return;

  let scope = dep.config.scope ?? 'service';
  if (scope === 'service') {
    addRunnerBuild(specs, dep.children.name, dep.children);
    return;
  }

  for (let childDep of dep.children.deps) {
    if (childDep.kind === 'control' && childDep.config.scope === 'service' && childDep.children) {
      addRunnerBuild(specs, childDep.children.name, childDep.children);
    }
  }

  addRunnerBuild(specs, dep.children.name, dep.children);
};

export let collectRunnerBuilds = (graph: ResolvedGraph): DockerBuildSpec[] => {
  let specs = new Map<string, DockerBuildSpec>();

  addRunnerBuild(specs, graph.name, graph);

  for (let dep of graph.deps) {
    collectControlRunnerBuilds(specs, dep);
  }

  return [...specs.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export let collectServiceRunnerBuilds = (graph: ResolvedGraph): DockerBuildSpec[] => {
  let specs = new Map<string, DockerBuildSpec>();
  addRunnerBuild(specs, graph.name, graph);
  return [...specs.values()];
};
