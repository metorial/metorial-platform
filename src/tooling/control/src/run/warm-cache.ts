import { createBuildPlan } from '../builders';
import { nxProjectHasTarget, readNxProjectGraph } from '../builders/nx';
import { resolveControlCwd } from '../entrypoint';
import { createLogger } from '../log';
import { getRegistry, resolveBuildTargets } from '../registry';
import type { ControlService } from '../types';
import { runShell } from './shell';

type WarmCacheOptions = {
  entrypoint?: string;
  all?: boolean;
  filters?: string[];
  includeUnit?: boolean;
  parallel?: number;
  services?: ControlService[];
  verbose?: boolean;
};

type TargetGroup = {
  cwd: string;
  target: string;
  projects: Set<string>;
};

let groupKey = (cwd: string, target: string) => `${cwd}:${target}`;

let addProject = (
  groups: Map<string, TargetGroup>,
  opts: { cwd: string; target: string; project: string }
) => {
  let key = groupKey(opts.cwd, opts.target);
  let group = groups.get(key);
  if (!group) {
    group = { cwd: opts.cwd, target: opts.target, projects: new Set<string>() };
    groups.set(key, group);
  }
  group.projects.add(opts.project);
};

export let runWarmCacheTargets = async (opts: WarmCacheOptions) => {
  let cwd = resolveControlCwd();
  let registry = getRegistry({ cwd, entrypoint: opts.entrypoint });
  let filters = opts.filters?.length ? opts.filters : undefined;
  let services = opts.services ?? resolveBuildTargets({
    registry,
    cwd,
    all: filters ? false : (opts.all ?? true),
    filters
  });
  let logger = createLogger(opts);
  let groups = new Map<string, TargetGroup>();

  for (let service of services) {
    let plan = createBuildPlan(service, registry);
    if (!plan?.project || !plan.target) continue;

    for (let automation of plan.automations) {
      for (let project of automation.projects) {
        addProject(groups, { cwd: plan.contextRoot, target: automation.target, project });
      }
    }

    addProject(groups, { cwd: plan.contextRoot, target: plan.target, project: plan.project });

    if (opts.includeUnit && service.config.test?.unit?.command.trim() === 'bun run test:unit') {
      let graph = readNxProjectGraph(plan.contextRoot);
      if (nxProjectHasTarget(graph, plan.project, 'test:unit')) {
        addProject(groups, { cwd: plan.contextRoot, target: 'test:unit', project: plan.project });
      }
    }
  }

  logger.info(`Warming ${groups.size} Nx target group(s)...`);

  for (let group of groups.values()) {
    let projects = [...group.projects].sort((a, b) => a.localeCompare(b));
    if (projects.length === 0) continue;

    await runShell(
      [
        'bun',
        'x',
        'nx',
        'run-many',
        `--target=${group.target}`,
        `--projects=${projects.join(',')}`,
        `--parallel=${opts.parallel ?? 3}`
      ],
      {
        cwd: group.cwd,
        phase: group.target === 'test:unit' ? 'test' : 'build',
        verbose: opts.verbose
      }
    );
  }
};
