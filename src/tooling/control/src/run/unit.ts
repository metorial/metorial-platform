import { join, resolve } from 'path';
import { resolveOssRoot, resolveControlCwd, resolveEntrypoint } from '../entrypoint';
import { resolveStagedEntrypoint } from '../staging/session';
import { NoTestError } from '../errors';
import { nxProjectHasTarget, readNxProjectGraph } from '../builders/nx';
import { createLogger } from '../log';
import { formatBatchSummary, formatRunPlan, formatServiceHeader } from '../log/formatRunPlan';
import { getRegistry } from '../registry';
import { planExecutionOrder } from '../graph/planner';
import type { BatchResult, BatchServiceResult, ControlService, RunOptions } from '../types';

type UnitContext = {
  index: number;
  total: number;
  service: ControlService;
};

export let resolveHostTestCwd = (opts: {
  service: ControlService;
  cwd?: string;
  entrypoint: string;
}): string => {
  if (!opts.cwd || opts.cwd === '.') return opts.service.dir;

  if (opts.cwd.startsWith('/app/')) {
    return join(resolveOssRoot(opts.entrypoint), opts.cwd.slice('/app/'.length));
  }

  if (opts.cwd.startsWith('/app')) {
    return join(resolveOssRoot(opts.entrypoint), opts.cwd.replace(/^\/app\/?/, ''));
  }

  return resolve(opts.service.dir, opts.cwd);
};

let runHostShell = async (cmd: string[], opts: { cwd: string; verbose?: boolean }) => {
  let proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit'
  });
  let code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Command failed with exit code ${code}: ${cmd.join(' ')}`);
  }
};

let resolveNxUnitCommand = (opts: {
  command: string;
  entrypoint: string;
  project?: string;
  setup?: string[];
}): { cwd: string; command: string } | null => {
  if (opts.command.trim() !== 'bun run test:unit') return null;
  if (opts.setup?.length) return null;
  if (!opts.project) return null;

  let ossRoot = resolveOssRoot(opts.entrypoint);
  let graph = readNxProjectGraph(ossRoot);
  if (!nxProjectHasTarget(graph, opts.project, 'test:unit')) return null;

  return {
    cwd: ossRoot,
    command: `bun x nx run ${opts.project}:test:unit`
  };
};

let runUnitForService = async (
  opts: RunOptions & { service: ControlService; context?: UnitContext }
) => {
  let logger = createLogger(opts);
  let unit = opts.service.config.test?.unit;
  if (!unit) throw new NoTestError({ name: opts.service.name, mode: 'unit' });

  let cwd = resolveControlCwd();
  let entrypoint = opts.session
    ? resolveStagedEntrypoint(opts.session, opts.entrypoint)
    : resolveEntrypoint({ cwd, entrypoint: opts.entrypoint });
  let nxUnit = resolveNxUnitCommand({
    command: unit.command,
    setup: unit.setup,
    project: opts.service.config.build?.project,
    entrypoint
  });
  let hostCwd = nxUnit?.cwd ?? resolveHostTestCwd({ service: opts.service, cwd: unit.cwd, entrypoint });
  let testCommand = nxUnit?.command ?? unit.command;

  if (opts.context) {
    logger.section(
      formatServiceHeader({
        index: opts.context.index,
        total: opts.context.total,
        service: opts.context.service,
        mode: 'unit'
      })
    );
  }

  logger.info(`Running unit tests in ${hostCwd} ...`);

  for (let step of unit.setup ?? []) {
    logger.info(`Setup: ${step}`);
    logger.debug(`Command: ${step}`);
    await runHostShell(['sh', '-c', step], { cwd: hostCwd, verbose: opts.verbose });
  }

  logger.info('Running unit tests...');
  logger.debug(`Command: ${testCommand}`);
  await runHostShell(['sh', '-c', testCommand], { cwd: hostCwd, verbose: opts.verbose });
};

export let runUnitBatch = async (
  opts: RunOptions & { services: ControlService[] }
): Promise<BatchResult> => {
  let logger = createLogger(opts);
  let registry = getRegistry({
    cwd: resolveControlCwd(),
    entrypoint: opts.entrypoint,
    session: opts.session ?? null
  });
  let ordered = planExecutionOrder(opts.services, registry);
  let passed: string[] = [];
  let failed: { name: string; error: Error; phase?: string }[] = [];
  let results: BatchServiceResult[] = [];
  let batchStarted = Date.now();

  for (let i = 0; i < ordered.length; i++) {
    let service = ordered[i]!;
    let started = Date.now();

    try {
      await runUnitForService({
        ...opts,
        service,
        context: { index: i + 1, total: ordered.length, service }
      });
      let durationMs = Date.now() - started;
      passed.push(service.name);
      results.push({
        name: service.name,
        relPath: service.relPath,
        status: 'passed',
        durationMs
      });
      logger.success(`✓ ${service.name} passed (${Math.round(durationMs / 1000)}s)`);
      logger.blank();
    } catch (err) {
      let error = err instanceof Error ? err : new Error(String(err));
      let durationMs = Date.now() - started;
      failed.push({ name: service.name, error, phase: 'test' });
      results.push({
        name: service.name,
        relPath: service.relPath,
        status: 'failed',
        durationMs,
        error,
        phase: 'test'
      });
      logger.error(`✗ ${service.name} failed: ${error.message}`);
      logger.blank();
    }
  }

  let totalDurationMs = Date.now() - batchStarted;

  logger.section(
    formatBatchSummary({
      mode: 'unit',
      totalDurationMs,
      results: results.map(r => ({
        name: r.name,
        relPath: r.relPath,
        status: r.status,
        durationMs: r.durationMs,
        phase: r.phase,
        errorMessage: r.error?.message
      }))
    })
  );

  return { passed, failed, results, totalDurationMs };
};

export let runUnitTargets = async (opts: RunOptions & { services: ControlService[] }) => {
  let logger = createLogger(opts);
  let registry = getRegistry({
    cwd: resolveControlCwd(),
    entrypoint: opts.entrypoint,
    session: opts.session ?? null
  });
  let ordered = planExecutionOrder(opts.services, registry);

  logger.section(
    formatRunPlan({
      mode: 'unit',
      controlRoot: registry.controlRoot,
      services: ordered,
      title: 'Control unit tests'
    })
  );
  logger.blank();

  if (ordered.length === 1) {
    await runUnitForService({
      ...opts,
      service: ordered[0]!,
      context: { index: 1, total: 1, service: ordered[0]! }
    });
    return;
  }

  let result = await runUnitBatch(opts);
  if (result.failed.length > 0) {
    process.exit(1);
  }
};
