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
import { getRegistry, resolveService, resolveTargets, resolveBuildTargets } from './registry';
import { planExecutionOrder } from './graph/planner';
import { runControlTargets } from './run/runner';
import { runBuildTargets } from './run/build';
import { formatControlError, InvalidFlagsError } from './errors';
import { createLogger, isVerbose } from './log';
import { formatRunPlan } from './log/formatRunPlan';
import { resolveControlCwd } from './entrypoint';
import { withWorkspaceSession } from './staging/session';
import type { WorkspaceSession } from './types';
import { runBootstrap } from './bootstrap';
import { installShutdownHandlers } from './run/lifecycle';
import { runWarmCacheTargets } from './run/warm-cache';
import { printCacheSummary, runCacheServer } from './nx-cache/server';

installShutdownHandlers();

type StagedCliOpts = {
  entrypoint?: string;
  verbose?: boolean;
  keep?: boolean;
  'no-stage'?: boolean;
};

let collectRepeatedOption = (argv: string[], names: string[]): string[] => {
  let values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]!;
    let match = names.find(name => arg === name || arg.startsWith(`${name}=`));
    if (match) {
      if (arg.startsWith(`${match}=`)) {
        let inlineValue = arg.slice(match.length + 1);
        if (inlineValue) values.push(inlineValue);
        continue;
      }

      let val = argv[i + 1];
      if (val && !val.startsWith('-')) {
        values.push(val);
        i++;
      }
    }
  }
  return values;
};

let collectFilters = (argv: string[]): string[] => collectRepeatedOption(argv, ['--filter', '-f']);

let collectModules = (argv: string[]): string[] =>
  collectRepeatedOption(argv, ['--module'])
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);

let collectTags = (argv: string[]): string[] =>
  collectRepeatedOption(argv, ['--tag'])
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);

let readBooleanOption = (opts: Record<string, unknown>, names: string[]): boolean =>
  names.some(name => opts[name] === true);

let collectManifestRestoreKeys = (argv: string[]): string[] =>
  collectRepeatedOption(argv, ['--manifest-restore-key'])
    .flatMap(value => value.split('\n'))
    .map(value => value.trim())
    .filter(Boolean);

let readCliOption = (argv: string[], name: string, fallback?: string): string | undefined =>
  collectRepeatedOption(argv, [name]).at(-1) ?? fallback;

let runCommand = async (fn: () => Promise<void | never>, opts?: { verbose?: boolean }) => {
  try {
    await fn();
  } catch (err) {
    let logger = createLogger(opts);
    logger.error(formatControlError(err, { verbose: isVerbose(opts) }));
    process.exit(1);
  }
};

let readNoStageOption = (opts: StagedCliOpts): boolean =>
  opts['no-stage'] === true ||
  (opts as StagedCliOpts & { noStage?: boolean; stage?: boolean }).noStage === true ||
  (opts as StagedCliOpts & { noStage?: boolean; stage?: boolean }).stage === false;

let prog = sade('control');

prog
  .command('bootstrap')
  .describe('Generate Nx config and Dockerfiles from control build configs')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--check', 'Fail if generated files are out of date')
  .option('--print', 'Print generated files instead of writing them')
  .option('--service, -s', 'Only generate for one service')
  .action(async (opts: { entrypoint?: string; check?: boolean; print?: boolean; service?: string }) => {
    await runCommand(async () => {
      await runBootstrap(opts);
    });
  });

prog
  .command('cache-server')
  .describe('Run the local Nx remote cache bridge')
  .option('--port', 'Port to listen on', '43191')
  .option('--host', 'Host to listen on', '127.0.0.1')
  .option('--root', 'Local artifact root', '.control/cache/nx-artifacts')
  .option('--manifest-dir', 'Digest manifest directory', '.control/cache/nx-manifest')
  .option('--stats', 'Stats output path', '.control/cache/nx-stats.json')
  .option('--ready-file', 'File written when the server is listening')
  .option('--namespace', 'GitHub cache namespace', 'v1')
  .option('--manifest-save-key', 'GitHub cache key for the updated digest manifest')
  .option('--manifest-primary-key', 'Primary GitHub cache key for digest manifest restore')
  .option('--manifest-restore-key', 'GitHub cache key or prefix for manifest restore')
  .option('--max-manifest-entries', 'Maximum digest manifest entries', '500')
  .option('--disable-github-uploads', 'Disable GitHub cache uploads from the bridge')
  .action(async (opts: Record<string, unknown>) => {
    await runCommand(async () => {
      let argv = process.argv;
      await runCacheServer({
        port: Number(readCliOption(argv, '--port', '43191')),
        host: readCliOption(argv, '--host', '127.0.0.1')!,
        root: readCliOption(argv, '--root', '.control/cache/nx-artifacts')!,
        manifestDir: readCliOption(argv, '--manifest-dir', '.control/cache/nx-manifest')!,
        statsPath: readCliOption(argv, '--stats', '.control/cache/nx-stats.json')!,
        readyFile: readCliOption(argv, '--ready-file'),
        namespace: readCliOption(argv, '--namespace', 'v1')!,
        manifestSaveKey: readCliOption(argv, '--manifest-save-key'),
        manifestRestoreKey: readCliOption(argv, '--manifest-primary-key') ?? readCliOption(argv, '--manifest-restore-key'),
        manifestRestoreKeys: collectManifestRestoreKeys(argv),
        maxManifestEntries: Number(readCliOption(argv, '--max-manifest-entries', '500')),
        githubUploads: !readBooleanOption(opts, ['disable-github-uploads'])
      });
    });
  });

prog
  .command('cache-finalize')
  .describe('Flush the local Nx cache bridge')
  .option('--server', 'Cache server URL', 'http://127.0.0.1:43191')
  .action(async (opts: { server?: string }) => {
    await runCommand(async () => {
      let res = await fetch(`${opts.server ?? 'http://127.0.0.1:43191'}/control/finalize`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Cache finalize failed with ${res.status}`);
      await res.text();
      console.log('Nx cache bridge finalized');
    });
  });

prog
  .command('cache-summary')
  .describe('Print local Nx cache bridge stats')
  .option('--stats', 'Stats output path', '.control/cache/nx-stats.json')
  .option('--root', 'Local artifact root', '.control/cache/nx-artifacts')
  .action(async (opts: { stats?: string; root?: string }) => {
    await runCommand(async () => {
      printCacheSummary(opts.stats ?? '.control/cache/nx-stats.json', opts.root ?? '.control/cache/nx-artifacts');
    });
  });

prog
  .command('warm-cache')
  .describe('Warm Nx cache for control build and unit test targets')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--all', 'Warm all services with build configs')
  .option('--filter, -f', 'Warm named services')
  .option('--include-unit', 'Warm cacheable unit test targets')
  .option('--parallel', 'Nx parallelism', '3')
  .option('--verbose, -v', 'Verbose output')
  .action(async (opts: Record<string, unknown>) => {
    await runCommand(async () => {
      let filters = collectFilters(process.argv);
      await runWarmCacheTargets({
        entrypoint: typeof opts.entrypoint === 'string' ? opts.entrypoint : undefined,
        all: filters.length === 0 ? opts.all !== false : false,
        filters,
        includeUnit: readBooleanOption(opts, ['include-unit', 'includeUnit']),
        parallel: Number(opts.parallel ?? 3),
        verbose: !!opts.verbose
      });
    }, { verbose: !!opts.verbose });
  });

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
  .option('--mode, -m', 'Plan mode: e2e, unit, or build', 'e2e')
  .option('--filter, -f', 'Filter by service name')
  .action(async (target: string | undefined, opts: { entrypoint?: string; all?: boolean; mode?: string; filter?: string }) => {
    await runCommand(async () => {
      if (opts.mode && opts.mode !== 'e2e' && opts.mode !== 'unit' && opts.mode !== 'build') {
        throw new InvalidFlagsError('Mode must be e2e, unit, or build');
      }
      let mode = (opts.mode === 'unit' ? 'unit' : opts.mode === 'build' ? 'build' : 'e2e') as
        | 'e2e'
        | 'unit'
        | 'build';
      let registry = getRegistry({ cwd: resolveControlCwd(), entrypoint: opts.entrypoint });
      let filters = collectFilters(process.argv);

      let services =
        mode === 'build'
          ? resolveBuildTargets({
              registry,
              cwd: resolveControlCwd(),
              target,
              all: opts.all,
              filters: filters.length ? filters : undefined
            })
          : resolveTargets({
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
          title: mode === 'build' ? 'Control build plan' : 'Control test plan'
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
    .option('--module', 'Run e2e tests for named module(s); repeat or comma-separate')
    .option('--keep', 'Keep containers and staged workspace after test')
    .option('--no-stage', 'Run against the live checkout instead of a staged copy')
    .option('--verbose, -v', 'Verbose output')
    .action(async (target: string | undefined, opts: StagedCliOpts & {
      'project-prefix'?: string;
      all?: boolean;
      filter?: string;
    }) => {
      await runCommand(async () => {
        await withWorkspaceSession(
          {
            entrypoint: opts.entrypoint,
            verbose: opts.verbose,
            keep: opts.keep,
            noStage: opts['no-stage']
          },
          async (session: WorkspaceSession | null) => {
            let registry = getRegistry({
              cwd: resolveControlCwd(),
              entrypoint: opts.entrypoint,
              session
            });
            let filters = collectFilters(process.argv);
            let modules = collectModules(process.argv);

            let services = resolveTargets({
              registry,
              cwd: resolveControlCwd(),
              target,
              all: opts.all,
              filters: filters.length ? filters : undefined,
              mode,
              session
            });

            let ordered = planExecutionOrder(services, registry);

            await runControlTargets({
              mode,
              entrypoint: opts.entrypoint,
              projectPrefix: opts['project-prefix'],
              keep: opts.keep,
              verbose: opts.verbose,
              noStage: opts['no-stage'],
              e2eModules: mode === 'e2e' && modules.length ? modules : undefined,
              session,
              services: ordered
            });
          }
        );
      }, { verbose: opts.verbose });
    });
};

addRunCommand('e2e', 'e2e');
addRunCommand('unit', 'unit');

prog
  .command('build [target]')
  .describe('Build runner Docker images for selected services')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--all', 'Build all services with [service] config')
  .option('--filter, -f', 'Build named services')
  .option('--keep', 'Keep staged workspace after build')
  .option('--no-stage', 'Build against the live checkout instead of a staged copy')
  .option('--verbose, -v', 'Verbose output')
  .option('--tag-prefix', 'Image tag prefix', 'control')
  .option('--image', 'Override image repository for the built runner image')
  .option('--tag', 'Image tag to apply; repeat or comma-separate for multiple tags')
  .option('--push', 'Push built image tags after a successful build')
  .option('--target-role', 'Dockerfile target role to build: service or test-runner', 'service')
  .action(async (target: string | undefined, opts: StagedCliOpts & {
    all?: boolean;
    'tag-prefix'?: string;
    image?: string;
    push?: boolean;
    'target-role'?: string;
    filter?: string;
  }) => {
    await runCommand(async () => {
      await withWorkspaceSession(
        {
          entrypoint: opts.entrypoint,
          verbose: opts.verbose,
          keep: opts.keep,
          noStage: readNoStageOption(opts)
        },
        async (session: WorkspaceSession | null) => {
          let registry = getRegistry({
            cwd: resolveControlCwd(),
            entrypoint: opts.entrypoint,
            session
          });
          let filters = collectFilters(process.argv);
          let tags = collectTags(process.argv);
          if (
            opts['target-role'] &&
            opts['target-role'] !== 'service' &&
            opts['target-role'] !== 'test-runner'
          ) {
            throw new InvalidFlagsError('target-role must be service or test-runner');
          }

          let services = resolveBuildTargets({
            registry,
            cwd: resolveControlCwd(),
            target,
            all: opts.all,
            filters: filters.length ? filters : undefined,
            session
          });

          let ordered = planExecutionOrder(services, registry);

          await runBuildTargets({
            entrypoint: opts.entrypoint,
            verbose: opts.verbose,
            tagPrefix: opts['tag-prefix'],
            image: opts.image,
            tags,
            push: !!opts.push,
            targetRole: opts['target-role'] === 'test-runner' ? 'test-runner' : 'service',
            keep: opts.keep,
            noStage: readNoStageOption(opts),
            session,
            services: ordered
          });
        }
      );
    }, { verbose: opts.verbose });
  });

prog
  .command('ci <mode> [target]')
  .describe('CI entrypoint (e2e or unit)')
  .option('--entrypoint, -e', 'Workspace entrypoint')
  .option('--project-prefix, -p', 'Docker compose project prefix')
  .option('--all', 'Run all services with this test mode')
  .option('--filter, -f', 'Run tests for named services')
  .option('--module', 'Run e2e tests for named module(s); repeat or comma-separate')
  .option('--keep', 'Keep containers and staged workspace after test')
  .option('--no-stage', 'Run against the live checkout instead of a staged copy')
  .action(async (mode: string, target: string | undefined, opts: StagedCliOpts & {
    'project-prefix'?: string;
    all?: boolean;
    filter?: string;
  }) => {
    let verbose = !!process.env.CONTROL_VERBOSE;
    await runCommand(async () => {
      if (mode !== 'e2e' && mode !== 'unit') {
        throw new InvalidFlagsError('Mode must be e2e or unit');
      }

      await withWorkspaceSession(
        {
          entrypoint: opts.entrypoint,
          verbose,
          keep: opts.keep,
          noStage: readNoStageOption(opts)
        },
        async (session: WorkspaceSession | null) => {
          let registry = getRegistry({
            cwd: resolveControlCwd(),
            entrypoint: opts.entrypoint,
            session
          });
          let filters = collectFilters(process.argv);
          let modules = collectModules(process.argv);

          let services = resolveTargets({
            registry,
            cwd: resolveControlCwd(),
            target,
            all: opts.all,
            filters: filters.length ? filters : undefined,
            mode: mode as 'e2e' | 'unit',
            session
          });

          let ordered = planExecutionOrder(services, registry);

          await runControlTargets({
            mode: mode as 'e2e' | 'unit',
            entrypoint: opts.entrypoint,
            projectPrefix: opts['project-prefix'],
            ci: true,
            verbose,
            keep: opts.keep,
            noStage: readNoStageOption(opts),
            e2eModules: mode === 'e2e' && modules.length ? modules : undefined,
            session,
            services: ordered
          });
        }
      );
    }, { verbose });
  });

prog.parse(process.argv);
