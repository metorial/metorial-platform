import type { ControlService, GlobalGraph, GlobalGraphEdge, GlobalGraphNode, ServiceRegistry } from '../types';
import { resolveControlDepTarget } from '../registry';
import { CircularDependencyError } from '../errors';

export type ControlDepGraph = {
  edges: Map<string, Set<string>>;
  missing: Map<string, Set<string>>;
};

export let buildControlDepGraph = (registry: ServiceRegistry): ControlDepGraph => {
  let edges = new Map<string, Set<string>>();
  let missing = new Map<string, Set<string>>();

  for (let service of registry.services) {
    if (!edges.has(service.name)) edges.set(service.name, new Set());
  }

  for (let service of registry.services) {
    for (let dep of service.config.deps ?? []) {
      if (!dep.control) continue;

      let child = resolveControlDepTarget(registry, service, dep.control);
      if (child) {
        if (!edges.has(service.name)) edges.set(service.name, new Set());
        edges.get(service.name)!.add(child.name);
        continue;
      }

      let missingName = dep.name;
      if (!missing.has(service.name)) missing.set(service.name, new Set());
      missing.get(service.name)!.add(missingName);
    }
  }

  return { edges, missing };
};

export let buildGlobalGraph = (registry: ServiceRegistry): GlobalGraph => {
  let { edges, missing } = buildControlDepGraph(registry);
  let nodeNames = new Set<string>();

  for (let service of registry.services) {
    nodeNames.add(service.name);
  }

  for (let [, deps] of edges) {
    for (let dep of deps) nodeNames.add(dep);
  }

  for (let [, deps] of missing) {
    for (let dep of deps) nodeNames.add(dep);
  }

  let byName = registry.byName;
  let nodes: GlobalGraphNode[] = [...nodeNames]
    .sort()
    .map(name => {
      let service = byName.get(name);
      if (service) {
        return { name, relPath: service.relPath };
      }
      return { name, relPath: '', missing: true };
    });

  let graphEdges: GlobalGraphEdge[] = [];
  for (let [from, deps] of edges) {
    for (let to of deps) {
      graphEdges.push({ from, to });
    }
  }
  for (let [from, deps] of missing) {
    for (let to of deps) {
      graphEdges.push({ from, to, missing: true });
    }
  }

  graphEdges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return { nodes, edges: graphEdges };
};

export let planExecutionOrder = (
  services: ControlService[],
  registry: ServiceRegistry
): ControlService[] => {
  if (services.length <= 1) return services;

  let selected = new Set(services.map(s => s.name));
  let { edges } = buildControlDepGraph(registry);
  let inDegree = new Map<string, number>();
  let adj = new Map<string, Set<string>>();

  for (let service of services) {
    inDegree.set(service.name, 0);
    adj.set(service.name, new Set());
  }

  for (let service of services) {
    let deps = edges.get(service.name) ?? new Set();
    for (let dep of deps) {
      if (!selected.has(dep)) continue;
      adj.get(dep)!.add(service.name);
      inDegree.set(service.name, (inDegree.get(service.name) ?? 0) + 1);
    }
  }

  let queue = services
    .filter(s => (inDegree.get(s.name) ?? 0) === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  let ordered: ControlService[] = [];
  let byName = registry.byName;

  while (queue.length > 0) {
    let current = queue.shift()!;
    ordered.push(byName.get(current.name)!);

    for (let next of [...(adj.get(current.name) ?? [])].sort()) {
      let deg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        queue.push(byName.get(next)!);
        queue.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  if (ordered.length !== services.length) {
    throw new CircularDependencyError({
      services: services.map(s => s.name)
    });
  }

  return ordered;
};
