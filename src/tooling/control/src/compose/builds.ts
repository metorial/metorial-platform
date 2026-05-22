import { resolve } from 'path';
import type { ResolvedDep, ResolvedGraph } from '../types';

export type DockerBuildConfig = {
  context: string;
  dockerfile: string;
  target: string;
};

export type DockerBuildSpec = DockerBuildConfig & {
  name: string;
};

export let resolveBuild = (
  graph: ResolvedGraph,
  opts?: { role: 'test-runner' | 'service' }
): DockerBuildConfig => {
  let svc = graph.config.service!;
  let dockerfile = svc.dockerfile ?? 'Dockerfile';
  let target = svc.docker_target ?? (opts?.role === 'test-runner' ? 'workspace' : 'runner');

  if (svc.build_context === 'oss') {
    return {
      context: graph.ossRoot,
      dockerfile: dockerfile.startsWith('./') ? dockerfile : `./${dockerfile.replace(/^\.\//, '')}`,
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
