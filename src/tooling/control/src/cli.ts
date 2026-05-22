#!/usr/bin/env bun
import sade from 'sade';
import { buildGlobalGraph } from './graph/planner';
import {
  formatGlobalGraphJson,
  formatGlobalGraphTree,
  formatServicesJson,
  formatServicesTable
} from './graph/format';
import { resolveGraph } from './graph/resolver';
import { generateCompose } from './compose/generator';
import { getRegistry, resolveService, resolveTargets } from './registry';
import { planExecutionOrder } from './graph/planner';
import { runControlTargets } from './run/runner';
import { formatControlError, InvalidFlagsError } from './errors';
import { createLogger, isVerbose } from './log';
import { formatRunPlan } from './log/formatRunPlan';
import { resolveControlCwd } from './entrypoint';

let collectFilters = (argv: string[]): string[] => {
  let filters: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--filter' || argv[i] === '-f') {
      let val = argv[i + 1];
      if (val && !val.startsWith('-')) {
        filters.push(val);
        i++;
      }
    }
  }
  return filters;
};

let runCommand = async (fn: () => Promise<void | never>, opts?: { verbose?: boolean }) => {
  try {
    await fn();
  } catch (err) {
    let logger = createLogger(opts);
    logger.error(formatControlError(err, { verbose: isVerbose(opts) }));
    process.exit(1);
  }
};

let prog = sade('control');

prog
  .command('ls')
  .describe('List all control-managed services')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--json', 'Output as JSON')
  .option('--filter, -f', 'Filter by service name')
  .action(async (opts: { entrypoint?: string; json?: boolean; filter?: string }) => {
    await runCommand(async () => {
      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
      let filters = collectFilters(process.argv);
      let services = filters.length
        ? filters.map(name => resolveService(registry, name))
        : registry.services;

      if (opts.json) {
        console.log(formatServicesJson(registry, services));
      } else {
        console.log(formatServicesTable(registry, services));
      }
    });
  });

prog
  .command('graph [target]')
  .describe('View dependency graph (global or per-service)')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--json', 'Output as JSON')
  .option('--format', 'Output format: tree or json (global graph only)')
  .action(async (target: string | undefined, opts: { entrypoint?: string; json?: boolean; format?: string }) => {
    await runCommand(async () => {
      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });

      if (!target) {
        let graph = buildGlobalGraph(registry);
        if (opts.json || opts.format === 'json') {
          console.log(formatGlobalGraphJson(graph));
        } else {
          console.log(formatGlobalGraphTree(registry));
        }
        return;
      }

      let service = resolveService(registry, target);
      let graph = resolveGraph({
        entrypoint: registry.controlRoot,
        targetDir: service.dir,
        registry
      });
      console.log(JSON.stringify(graph, null, 2));
    });
  });

prog
  .command('plan [target]')
  .describe('Show test execution order for selected services')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--all', 'Plan all services with tests for the given mode')
  .option('--mode, -m', 'Test mode: e2e or unit', 'e2e')
  .option('--filter, -f', 'Filter by service name')
  .action(async (target: string | undefined, opts: { entrypoint?: string; all?: boolean; mode?: string; filter?: string }) => {
    await runCommand(async () => {
      if (opts.mode && opts.mode !== 'e2e' && opts.mode !== 'unit') {
        throw new InvalidFlagsError('Mode must be e2e or unit');
      }
      let mode = (opts.mode === 'unit' ? 'unit' : 'e2e') as 'e2e' | 'unit';
      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
      let filters = collectFilters(process.argv);

      let services = resolveTargets({
        registry,
        cwd: resolveControlCwd(),
        target,
        all: opts.all,
        filters: filters.length ? filters : undefined,
        mode
      });

      let ordered = planExecutionOrder(services, registry);
      console.log(
        formatRunPlan({
          mode,
          controlRoot: registry.controlRoot,
          services: ordered,
          title: 'Control test plan'
        })
      );
    });
  });

prog
  .command('compose print <target>')
  .describe('Print generated docker compose')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .action(async (target: string, opts: { entrypoint?: string }) => {
    await runCommand(async () => {
      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
      let service = resolveService(registry, target);
      let graph = resolveGraph({ entrypoint: registry.controlRoot, targetDir: service.dir, registry });
      console.log(generateCompose(graph, `control-${graph.name}`));
    });
  });

let addRunCommand = (mode: 'e2e' | 'unit', name: string) => {
  prog
    .command(`${name} [target]`)
    .describe(`Run ${mode} tests for a service`)
    .option('--entrypoint, -e', 'Workspace entrypoint')
    .option('--project-prefix, -p', 'Docker compose project prefix')
    .option('--all', 'Run all services with this test mode')
    .option('--filter, -f', 'Run tests for named services')
    .option('--keep', 'Keep containers running after test')
    .option('--verbose, -v', 'Verbose output')
    .action(async (target: string | undefined, opts: {
      entrypoint?: string;
      'project-prefix'?: string;
      all?: boolean;
      keep?: boolean;
      verbose?: boolean;
      filter?: string;
    }) => {
      await runCommand(async () => {
        let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
        let filters = collectFilters(process.argv);

        let services = resolveTargets({
          registry,
          cwd: resolveControlCwd(),
          target,
          all: opts.all,
          filters: filters.length ? filters : undefined,
          mode
        });

        let ordered = planExecutionOrder(services, registry);

        await runControlTargets({
          mode,
          entrypoint: opts.entrypoint,
          projectPrefix: opts['project-prefix'],
          keep: opts.keep,
          verbose: opts.verbose,
          services: ordered
        });
      }, { verbose: opts.verbose });
    });
};

addRunCommand('e2e', 'e2e');
addRunCommand('unit', 'unit');

prog
  .command('ci <mode> [target]')
  .describe('CI entrypoint (e2e or unit)')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--project-prefix, -p', 'Docker compose project prefix')
  .option('--all', 'Run all services with this test mode')
  .option('--filter, -f', 'Run tests for named services')
  .action(async (mode: string, target: string | undefined, opts: {
    entrypoint?: string;
    'project-prefix'?: string;
    all?: boolean;
    filter?: string;
  }) => {
    let verbose = !!process.env.CONTROL_VERBOSE;
    await runCommand(async () => {
      if (mode !== 'e2e' && mode !== 'unit') {
        throw new InvalidFlagsError('Mode must be e2e or unit');
      }

      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
      let filters = collectFilters(process.argv);

      let services = resolveTargets({
        registry,
        cwd: resolveControlCwd(),
        target,
        all: opts.all,
        filters: filters.length ? filters : undefined,
        mode: mode as 'e2e' | 'unit'
      });

      let ordered = planExecutionOrder(services, registry);

      await runControlTargets({
        mode: mode as 'e2e' | 'unit',
        entrypoint: opts.entrypoint,
        projectPrefix: opts['project-prefix'],
        ci: true,
        verbose,
        services: ordered
      });
    }, { verbose });
  });

prog.parse(process.argv);
