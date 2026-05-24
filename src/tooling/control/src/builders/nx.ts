import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { ControlError } from '../errors';

type NxGraphDependency = {
  source: string;
  target: string;
  type: string;
};

type NxGraphProjectNode = {
  name: string;
  type: string;
  data: {
    root: string;
    name?: string;
    metadata?: Record<string, unknown>;
  };
};

type NxProjectGraph = {
  nodes: Record<string, NxGraphProjectNode>;
  externalNodes?: Record<string, unknown>;
  dependencies: Record<string, NxGraphDependency[]>;
};

let normalize = (value: string) => value.replace(/\\/g, '/');

let graphCachePathForRoot = (workspaceRoot: string) =>
  join(workspaceRoot, '.nx', 'workspace-data', 'project-graph.json');

let ensureNxGraph = (workspaceRoot: string) => {
  let cachePath = graphCachePathForRoot(workspaceRoot);
  if (existsSync(cachePath)) return;

  let proc = Bun.spawnSync(['bun', 'x', 'nx', 'show', 'projects', '--json'], {
    cwd: workspaceRoot,
    stdout: 'ignore',
    stderr: 'pipe'
  });

  if (proc.exitCode !== 0) {
    throw new ControlError({
      code: 'nx_graph_unavailable',
      message: `Unable to generate Nx project graph in ${workspaceRoot}`,
      details: [Buffer.from(proc.stderr).toString('utf8').trim()].filter(Boolean)
    });
  }
};

export let readNxProjectGraph = (workspaceRoot: string): NxProjectGraph => {
  let root = resolve(workspaceRoot);
  ensureNxGraph(root);
  let cachePath = graphCachePathForRoot(root);

  if (!existsSync(cachePath)) {
    throw new ControlError({
      code: 'nx_graph_missing',
      message: `Nx project graph cache is missing at ${cachePath}`
    });
  }

  return JSON.parse(readFileSync(cachePath, 'utf8')) as NxProjectGraph;
};

export let getNxProjectRoot = (graph: NxProjectGraph, project: string): string => {
  let node = graph.nodes[project];
  if (!node) {
    throw new ControlError({
      code: 'nx_project_missing',
      message: `Nx project "${project}" is not present in the workspace graph`
    });
  }

  return normalize(node.data.root);
};

let internalDependenciesOf = (graph: NxProjectGraph, project: string): string[] =>
  (graph.dependencies[project] ?? [])
    .map(dep => dep.target)
    .filter(target => !!graph.nodes[target]);

export let collectNxProjectClosure = (graph: NxProjectGraph, seeds: string[]): string[] => {
  let seen = new Set<string>();
  let queue = [...seeds];

  while (queue.length > 0) {
    let project = queue.shift()!;
    if (seen.has(project)) continue;
    if (!graph.nodes[project]) {
      throw new ControlError({
        code: 'nx_project_missing',
        message: `Nx project "${project}" is not present in the workspace graph`
      });
    }

    seen.add(project);
    for (let dep of internalDependenciesOf(graph, project)) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }

  return [...seen].sort((a, b) => a.localeCompare(b));
};

let wildcardToRegex = (pattern: string): RegExp =>
  new RegExp(
    '^' +
      pattern
        .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
        .replace(/\*/g, '.*') +
      '$'
  );

export let collectNxDependents = (opts: {
  graph: NxProjectGraph;
  seeds: string[];
  projectFilter?: string;
}): string[] => {
  let reverse = new Map<string, Set<string>>();

  for (let [source, deps] of Object.entries(opts.graph.dependencies)) {
    for (let dep of deps) {
      if (!opts.graph.nodes[dep.target]) continue;
      let sources = reverse.get(dep.target) ?? new Set<string>();
      sources.add(source);
      reverse.set(dep.target, sources);
    }
  }

  let seen = new Set<string>(opts.seeds);
  let queue = [...opts.seeds];
  let collected = new Set<string>();
  let matcher = opts.projectFilter ? wildcardToRegex(opts.projectFilter) : null;

  while (queue.length > 0) {
    let project = queue.shift()!;
    for (let dependent of reverse.get(project) ?? []) {
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      queue.push(dependent);

      if (!matcher || matcher.test(dependent)) {
        collected.add(dependent);
      }
    }
  }

  return [...collected].sort((a, b) => a.localeCompare(b));
};

export let renderNxRunManyCommand = (opts: { target: string; projects: string[] }): string => {
  if (opts.projects.length === 0) {
    throw new ControlError({
      code: 'nx_automation_missing_projects',
      message: `Automation target "${opts.target}" resolved to no Nx projects`
    });
  }

  return `bun x nx run-many --target=${opts.target} --projects=${opts.projects.join(',')}`;
};
