import { createBuildPlan } from '../builders';
import { shouldUsePrebuiltBuildArtifacts } from '../builders/base';
import type { ResolvedGraph, ServiceRegistry } from '../types';
import { createLogger } from '../log';
import { runShell } from './shell';

let collectBuildGraphs = (graph: ResolvedGraph): ResolvedGraph[] => {
  let graphs: ResolvedGraph[] = [];
  let seen = new Set<string>();

  let visit = (graph: ResolvedGraph) => {
    if (seen.has(graph.name)) return;
    seen.add(graph.name);
    graphs.push(graph);

    for (let dep of graph.deps) {
      if (dep.kind === 'control' && dep.children) visit(dep.children);
    }
  };

  visit(graph);
  return graphs;
};

export let preparePrebuiltBuildArtifacts = async (opts: {
  graph: ResolvedGraph;
  registry: ServiceRegistry;
  verbose?: boolean;
}) => {
  if (!shouldUsePrebuiltBuildArtifacts()) return;

  let logger = createLogger({ verbose: opts.verbose });
  let commands = new Map<string, { cwd: string; command: string; service: string }>();

  for (let graph of collectBuildGraphs(opts.graph)) {
    let service = opts.registry.byName.get(graph.name);
    if (!service?.config.build || service.config.build.mode === 'custom') continue;

    let plan = createBuildPlan(service, opts.registry);
    if (!plan?.project || !plan.target) continue;

    for (let layer of plan.sourceLayers) {
      for (let command of layer.commands) {
        commands.set(`${plan.contextRoot}:${command}`, {
          cwd: plan.contextRoot,
          command,
          service: service.name
        });
      }
    }

    for (let automation of plan.automations) {
      commands.set(`${plan.contextRoot}:${automation.command}`, {
        cwd: plan.contextRoot,
        command: automation.command,
        service: service.name
      });
    }

    let mainCommand = `bun x nx run ${plan.project}:${plan.target}`;
    commands.set(`${plan.contextRoot}:${mainCommand}`, {
      cwd: plan.contextRoot,
      command: mainCommand,
      service: service.name
    });
  }

  if (commands.size === 0) return;

  logger.info(`Preparing ${commands.size} host build artifact task(s)...`);
  for (let { cwd, command, service } of commands.values()) {
    logger.debug(`Host build prep (${service}): ${command}`);
    await runShell(['sh', '-c', command], {
      cwd,
      phase: 'build',
      service,
      verbose: opts.verbose
    });
  }
};
