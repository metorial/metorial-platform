import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { createBuildPlan, renderDockerfileForPlan } from '../builders';
import { materializeBuildContext } from '../builders/context';
import { collectServiceRunnerBuilds } from '../compose/builds';
import { resolveGraph } from '../graph/resolver';
import { resolveControlDir, resolveEntrypoint, resolveControlCwd } from '../entrypoint';
import { resolveStagedEntrypoint } from '../staging/session';
import { getRegistry } from '../registry';
import { planExecutionOrder } from '../graph/planner';
import { createLogger } from '../log';
import { formatBatchSummary, formatRunPlan, formatServiceHeader } from '../log/formatRunPlan';
import { ControlError, DockerError } from '../errors';
import type { BatchResult, BatchServiceResult, BuildOptions, ControlService } from '../types';
import { runShell } from './shell';

type BuildContext = {
  index: number;
  total: number;
  service: ControlService;
};

let imageTag = (opts: { tagPrefix: string; rootName: string; specName: string }) =>
  `${opts.tagPrefix}/${opts.rootName}-${opts.specName}:local`;

let buildCacheDir = (opts: { controlRoot: string; rootName: string; specName: string }) =>
  resolve(opts.controlRoot, '.control', 'cache', 'buildkit', `${opts.rootName}-${opts.specName}`);

let shouldUseBuildCacheExport = () => process.env.CONTROL_BUILDKIT_CACHE === '1';

let appendRemoteNxCacheArgs = (cmd: string[]) => {
  let url = process.env.CONTROL_NX_REMOTE_CACHE_DOCKER_URL;
  if (!url) return;

  cmd.push(
    '--add-host',
    'host.docker.internal:host-gateway',
    '--build-arg',
    `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${url}`
  );
};

let runBuildForService = async (
  opts: BuildOptions & { service: ControlService; context?: BuildContext }
) => {
  let logger = createLogger(opts);
  let cwd = resolveControlCwd();
  let entrypoint = opts.session
    ? resolveStagedEntrypoint(opts.session, opts.entrypoint)
    : resolveEntrypoint({ cwd, entrypoint: opts.entrypoint });
  let registry = getRegistry({ cwd, entrypoint: opts.entrypoint, session: opts.session ?? null });
  let targetDir = resolveControlDir(entrypoint, opts.service.relPath);
  let graph = resolveGraph({ entrypoint, targetDir, registry });
  let tagPrefix = opts.tagPrefix ?? 'control';

  if (opts.context) {
    logger.section(
      formatServiceHeader({
        index: opts.context.index,
        total: opts.context.total,
        service: opts.context.service,
        mode: 'build'
      })
    );
  }

  let specs = collectServiceRunnerBuilds(graph);
  logger.info(`Building ${specs.length} runner image(s) for ${graph.name}...`);

  for (let spec of specs) {
    let dockerfilePath = resolve(spec.context, spec.dockerfile);
    let dockerContext = spec.context;
    let tag = imageTag({ tagPrefix, rootName: graph.name, specName: spec.name });
    let targetService = registry.byName.get(spec.name);

    logger.info(`Building ${spec.name} (${spec.target}) ...`);

    if (targetService?.config.build?.mode && targetService.config.build.mode !== 'custom') {
      let plan = createBuildPlan(targetService, registry);
      if (!plan) {
        throw new ControlError({
          code: 'build_plan_unavailable',
          message: `Unable to create build plan for ${targetService.name}`
        });
      }

      let renderedDockerfile = renderDockerfileForPlan(plan);
      let materialized = await materializeBuildContext({
        plan,
        registry,
        session: opts.session ?? null,
        renderedDockerfile
      });
      dockerContext = materialized.root;
      dockerfilePath = materialized.dockerfilePath;
    }

    let cmd = [
      'docker',
      'build',
      '-f',
      dockerfilePath,
      '--target',
      spec.target,
      '-t',
      tag
    ];
    if (shouldUseBuildCacheExport()) {
      let cacheDir = buildCacheDir({
        controlRoot: registry.controlRoot,
        rootName: graph.name,
        specName: spec.name
      });
      mkdirSync(dirname(cacheDir), { recursive: true });
      if (existsSync(cacheDir)) {
        cmd.push('--cache-from', `type=local,src=${cacheDir}`);
      }
      cmd.push('--cache-to', `type=local,dest=${cacheDir},mode=max`);
    }

    appendRemoteNxCacheArgs(cmd);

    if (process.env.SENTRY_AUTH_TOKEN) {
      cmd.push('--build-arg', `SENTRY_AUTH_TOKEN=${process.env.SENTRY_AUTH_TOKEN}`);
    }

    cmd.push(dockerContext);

    await runShell(cmd, {
      phase: 'build',
      service: graph.name,
      verbose: opts.verbose
    });

    logger.success(`✓ ${tag}`);
  }
};

let getFailedPhase = (err: Error): string | undefined => {
  if ('failedPhase' in err && typeof (err as { failedPhase?: string }).failedPhase === 'string') {
    return (err as { failedPhase?: string }).failedPhase;
  }
  if (err instanceof DockerError) return err.phase;
  return undefined;
};

export let runBuildBatch = async (
  opts: BuildOptions & { services: ControlService[] }
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
      await runBuildForService({
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
      logger.success(`✓ ${service.name} built (${Math.round(durationMs / 1000)}s)`);
      logger.blank();
    } catch (err) {
      let error = err instanceof Error ? err : new Error(String(err));
      let phase = getFailedPhase(error);
      let durationMs = Date.now() - started;
      failed.push({ name: service.name, error, phase });
      results.push({
        name: service.name,
        relPath: service.relPath,
        status: 'failed',
        durationMs,
        error,
        phase
      });
      logger.error(`✗ ${service.name} failed${phase ? ` during ${phase}` : ''}: ${error.message}`);
      logger.blank();
    }
  }

  let totalDurationMs = Date.now() - batchStarted;

  logger.section(
    formatBatchSummary({
      mode: 'build',
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

export let runBuildTargets = async (opts: BuildOptions & { services: ControlService[] }) => {
  let logger = createLogger(opts);
  let registry = getRegistry({
    cwd: resolveControlCwd(),
    entrypoint: opts.entrypoint,
    session: opts.session ?? null
  });
  let ordered = planExecutionOrder(opts.services, registry);

  logger.section(
    formatRunPlan({
      mode: 'build',
      controlRoot: registry.controlRoot,
      services: ordered,
      title: 'Control build'
    })
  );
  logger.blank();

  if (ordered.length === 1) {
    await runBuildForService({
      ...opts,
      service: ordered[0]!,
      context: { index: 1, total: 1, service: ordered[0]! }
    });
    return;
  }

  let result = await runBuildBatch(opts);
  if (result.failed.length > 0) {
    process.exit(1);
  }
};
