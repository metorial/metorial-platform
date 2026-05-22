import type { ControlService, GlobalGraph, ServiceRegistry } from '../types';
import { buildControlDepGraph } from './planner';

export let formatServicesTable = (registry: ServiceRegistry, services?: ControlService[]): string => {
  let list = services ?? registry.services;
  let lines: string[] = [];
  lines.push(`Control root: ${registry.controlRoot}`);
  lines.push(`Services: ${list.length}`);
  lines.push('');
  lines.push(`${'NAME'.padEnd(22)}${'PATH'.padEnd(44)}E2E  UNIT`);

  for (let service of list) {
    let e2e = service.config.test?.e2e ? 'yes' : '-';
    let unit = service.config.test?.unit ? 'yes' : '-';
    lines.push(`${service.name.padEnd(22)}${service.relPath.padEnd(44)}${e2e.padEnd(5)}${unit}`);
  }

  return lines.join('\n');
};

export let formatServicesJson = (registry: ServiceRegistry, services?: ControlService[]): string => {
  let list = services ?? registry.services;
  return JSON.stringify(
    {
      controlRoot: registry.controlRoot,
      ossRoot: registry.ossRoot,
      services: list.map(s => ({
        name: s.name,
        relPath: s.relPath,
        dir: s.dir,
        e2e: !!s.config.test?.e2e,
        unit: !!s.config.test?.unit
      }))
    },
    null,
    2
  );
};

export let formatGlobalGraphJson = (graph: GlobalGraph): string => {
  return JSON.stringify(graph, null, 2);
};

export let formatGlobalGraphTree = (registry: ServiceRegistry): string => {
  let { edges, missing } = buildControlDepGraph(registry);
  let isDepTarget = new Set<string>();
  for (let [, deps] of edges) {
    for (let dep of deps) isDepTarget.add(dep);
  }

  let roots = registry.services
    .map(s => s.name)
    .filter(name => !isDepTarget.has(name))
    .sort();

  if (roots.length === 0) {
    roots = registry.services.map(s => s.name).sort();
  }

  let visited = new Set<string>();
  let lines: string[] = [];

  let getChildren = (name: string): string[] => {
    let children: string[] = [];
    for (let dep of edges.get(name) ?? []) children.push(dep);
    for (let dep of missing.get(name) ?? []) children.push(`${dep} (missing)`);
    return children.sort();
  };

  let render = (name: string, prefix: string, isLast: boolean, isRoot: boolean) => {
    let displayName = name.endsWith(' (missing)') ? name : name;
    let inRegistry = !name.endsWith('(missing)') && registry.byName.has(name.replace(' (missing)', ''));

    if (!name.endsWith('(missing)') && visited.has(name)) {
      lines.push(`${prefix}${isRoot ? '' : isLast ? '└── ' : '├── '}${displayName} (see above)`);
      return;
    }

    if (!name.endsWith('(missing)')) visited.add(name);

    let label = inRegistry || name.endsWith('(missing)') ? displayName : `${displayName} (missing)`;
    lines.push(`${prefix}${isRoot ? '' : isLast ? '└── ' : '├── '}${label}`);

    let children = name.endsWith('(missing)') ? [] : getChildren(name);
    let childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

    children.forEach((child, i) => {
      render(child, childPrefix, i === children.length - 1, false);
    });
  };

  roots.forEach((root, i) => {
    render(root, '', i === roots.length - 1, true);
    if (i < roots.length - 1) lines.push('');
  });

  return lines.join('\n');
};

export let formatPlan = (opts: {
  mode: 'e2e' | 'unit';
  controlRoot: string;
  services: ControlService[];
}): string => {
  return [
    'Control test plan',
    `  Mode:         ${opts.mode}`,
    `  Control root: ${opts.controlRoot}`,
    `  Services:     ${opts.services.length}`,
    '',
    'Execution order:',
    ...opts.services.map(
      (service, i) => `  ${String(i + 1).padStart(2)}. ${service.name.padEnd(24)} ${service.relPath}`
    )
  ].join('\n');
};
