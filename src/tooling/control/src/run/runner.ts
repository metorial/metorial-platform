import { mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join, relative, resolve } from 'path';
import { generateCompose, collectContainerNames } from '../compose/generator';
import { createBuildPlan, renderDockerfileForPlan } from '../builders';
import { shouldUsePrebuiltBuildArtifacts } from '../builders/base';
import { materializeBuildContext } from '../builders/context';
import { generatePostgresInitScript } from '../compose/databaseInit';
import { postgresDatabasesForDep } from '../graph/databases';
import { resolveGraph } from '../graph/resolver';
import { resolveControlDir, resolveEntrypoint, resolveControlCwd, findControlRoot } from '../entrypoint';
import { resolveStagedEntrypoint } from '../staging/session';
import { getRegistry } from '../registry';
import { planExecutionOrder } from '../graph/planner';
import { createLogger } from '../log';
import { formatBatchSummary, formatRunPlan, formatServiceHeader } from '../log/formatRunPlan';
import { DockerError, HealthTimeoutError, NoTestError } from '../errors';
import { cleanupComposeStack, registerComposeStack, unregisterComposeStack } from './lifecycle';
import type {
  BatchResult,
  BatchServiceResult,
  ControlService,
  RunOptions,
  RunPhase,
  ResolvedGraph,
  ServiceRegistry,
  WorkspaceSession
} from '../types';
import { runShell } from './shell';
import { runUnitTargets } from './unit';
import type { DockerBuildConfig } from '../compose/builds';
import { preparePrebuiltBuildArtifacts } from './prebuiltArtifacts';

type RunControlContext = {
  index: number;
  total: number;
  service: ControlService;
};

let shouldRetrySetupStep = (command: string) =>
  command.includes('prisma generate') || command.includes('prisma:generate');

let renderSetupStep = (command: string) => {
  if (!shouldRetrySetupStep(command)) return command;

  return `{ attempt=1; until ${command}; do code=$?; if [ "$attempt" -ge 3 ]; then exit "$code"; fi; sleep $((attempt * 2)); attempt=$((attempt + 1)); done; }`;
};

let waitForServices = async (opts: {
  services: string[];
  verbose?: boolean;
  logger: ReturnType<typeof createLogger>;
}): Promise<void> => {
  let attempts = 60;
  let interval = 5000;

  let inspect = async (service: string) => {
    let proc = Bun.spawn(['docker', 'inspect', '-f', '{{.State.Health.Status}}', service], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    let out = (await new Response(proc.stdout).text()).trim();
    await proc.exited;

    if (out && out !== '{{.State.Health.Status}}' && out !== 'none' && out !== 'None') {
      return out;
    }

    let proc2 = Bun.spawn(['docker', 'inspect', '-f', '{{.State.Status}}', service], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    let out2 = (await new Response(proc2.stdout).text()).trim();
    await proc2.exited;
    return out2 || 'missing';
  };

  opts.logger.info(`Waiting for ${opts.services.length} container(s)...`);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let pending: { name: string; status: string }[] = [];

    for (let service of opts.services) {
      let status = await inspect(service);
      let ready = status === 'healthy' || status === 'running';
      if (!ready) pending.push({ name: service, status });
      if (opts.verbose) opts.logger.debug(`  ${service}: ${status}`);
    }

    if (pending.length === 0) return;
    await Bun.sleep(interval);
  }

  let finalStatuses: { name: string; status: string }[] = [];
  for (let service of opts.services) {
    finalStatuses.push({ name: service, status: await inspect(service) });
  }

  throw new HealthTimeoutError({ containers: finalStatuses });
};

let collectMaterializedBuildContexts = async (opts: {
  graph: ResolvedGraph;
  registry: ServiceRegistry;
  session?: WorkspaceSession | null;
}): Promise<Record<string, Pick<DockerBuildConfig, 'context' | 'dockerfile'>>> => {
  let contexts: Record<string, Pick<DockerBuildConfig, 'context' | 'dockerfile'>> = {};
  let seen = new Set<string>();

  let visit = async (graph: ResolvedGraph) => {
    if (!seen.has(graph.name)) {
      seen.add(graph.name);
      let service = opts.registry.byName.get(graph.name);

      if (service?.config.build?.mode && service.config.build.mode !== 'custom') {
        let plan = createBuildPlan(service, opts.registry);
        if (plan) {
          let renderedDockerfile = renderDockerfileForPlan(plan);
          let materialized = await materializeBuildContext({
            plan,
            registry: opts.registry,
            session: opts.session ?? null,
            renderedDockerfile
          });

          contexts[graph.name] = {
            context: materialized.root,
            dockerfile: `./${relative(materialized.root, materialized.dockerfilePath).replace(/\\/g, '/')}`
          };
        }
      }
    }

    for (let dep of graph.deps) {
      if (dep.kind === 'control' && dep.children) {
        await visit(dep.children);
      }
    }
  };

  await visit(opts.graph);
  return contexts;
};

let resolvePrebuiltImages = () => {
  if (process.env.CONTROL_PREBUILT_IMAGES !== '1') return undefined;

  return {
    prefix: process.env.CONTROL_PREBUILT_IMAGE_PREFIX ?? 'control',
    tag: process.env.CONTROL_PREBUILT_IMAGE_TAG ?? 'local'
  };
};

export let runControl = async (
  opts: RunOptions & { target: string; context?: RunControlContext }
) => {
  let logger = createLogger(opts);
  let cwd = resolveControlCwd();
  let entrypoint = opts.session
    ? resolveStagedEntrypoint(opts.session, opts.entrypoint)
    : resolveEntrypoint({ cwd, entrypoint: opts.entrypoint });
  let registry = getRegistry({ cwd, entrypoint: opts.entrypoint, session: opts.session ?? null });
  let targetDir = resolveControlDir(entrypoint, opts.target);
  let graph = resolveGraph({ entrypoint, targetDir, registry });
  let runId = `${Date.now()}`;
  let projectName = opts.projectPrefix ?? `control-${graph.name}-${runId}`;
  let serviceName = graph.name;

  if (opts.context) {
    logger.section(
      formatServiceHeader({
        index: opts.context.index,
        total: opts.context.total,
        service: opts.context.service,
        mode: opts.mode,
        projectName
      })
    );
    logger.blank();
  }

  let repoRoot = opts.session?.repoRoot ?? findControlRoot(cwd);
  let runDir = join(repoRoot, '.control', 'runs', runId);
  mkdirSync(runDir, { recursive: true });

  let prebuiltImages = resolvePrebuiltImages();

  if (!prebuiltImages && shouldUsePrebuiltBuildArtifacts()) {
    await preparePrebuiltBuildArtifacts({
      graph,
      registry,
      verbose: opts.verbose
    });
  }

  let buildContexts = prebuiltImages
    ? {}
    : await collectMaterializedBuildContexts({
        graph,
        registry,
        session: opts.session ?? null
      });

  let postgresInitScripts: Record<string, string> = {};
  for (let dep of graph.deps) {
    if (dep.kind !== 'preset' || dep.config.preset !== 'postgres') continue;

    let databases = postgresDatabasesForDep(graph, dep.name);
    if (databases.length === 0) continue;

    let initPath = join(runDir, `postgres-init-${dep.name}.sh`);
    writeFileSync(initPath, generatePostgresInitScript(databases), { mode: 0o755 });
    chmodSync(initPath, 0o755);
    postgresInitScripts[dep.name] = initPath;
  }

  let composeFile = join(runDir, 'compose.yml');
  let envFile = join(runDir, '.env.control');
  let cacheRoot = process.env.CONTROL_BUILDKIT_CACHE === '1'
    ? resolve(opts.session?.repoRoot ?? registry.controlRoot, '.control', 'cache', 'buildkit')
    : undefined;
  if (cacheRoot) mkdirSync(cacheRoot, { recursive: true });

  writeFileSync(
    composeFile,
    generateCompose(graph, projectName, {
      postgresInitScripts,
      buildContexts,
      cacheRoot,
      prebuiltImages
    })
  );

  let envLines = Object.entries(graph.env).map(([k, v]) => `${k}=${JSON.stringify(v).slice(1, -1)}`);
  writeFileSync(envFile, envLines.join('\n') + '\n');

  logger.debug(`Compose file: ${composeFile}`);
  logger.debug(`Env file: ${envFile}`);
  logger.debug(`Dependencies: ${graph.deps.length}`);

  if (opts.verbose) {
    logger.debug(await Bun.file(composeFile).text());
  }

  let isSidecar = graph.config.test?.e2e?.runner === 'sidecar';
  let runnerContainer = isSidecar || prebuiltImages ? `${projectName}-test` : `${projectName}-service`;
  let failedPhase: RunPhase = 'build';
  let composeStack = { projectName, composeFile, cwd: runDir };
  if (!opts.keep) registerComposeStack(composeStack);

  try {
    failedPhase = 'build';
    logger.info('Building containers...');
    logger.debug(`Command: docker compose -p ${projectName} up -d --build`);
    await runShell(
      ['docker', 'compose', '-p', projectName, '-f', composeFile, '--env-file', envFile, 'up', '-d', '--build'],
      {
        cwd: runDir,
        env: { COMPOSE_PARALLEL_LIMIT: process.env.COMPOSE_PARALLEL_LIMIT ?? '1' },
        phase: 'build',
        service: serviceName,
        composeFile,
        keep: opts.keep,
        verbose: opts.verbose
      }
    );

    failedPhase = 'health';
    let waitServices = collectContainerNames(graph, projectName);
    if (prebuiltImages) {
      for (let container of [`${projectName}-service`, `${projectName}-test`]) {
        if (!waitServices.includes(container)) waitServices.push(container);
      }
    }
    await waitForServices({ services: waitServices, verbose: opts.verbose, logger });

    let e2e = graph.config.test?.e2e;
    if (!e2e) throw new NoTestError({ name: graph.name, mode: 'e2e' });

    let cwdInContainer = e2e.cwd ?? '.';
    let setupSteps = e2e.setup ?? [];
    if (setupSteps.length > 0) {
      failedPhase = 'test-setup';
      logger.info(`Running setup (${setupSteps.length} step${setupSteps.length === 1 ? '' : 's'})...`);
      for (let step of setupSteps) logger.debug(`  setup: ${step}`);
    }

    failedPhase = 'test';
    logger.info(`Running ${opts.mode} tests...`);

    let setup = setupSteps.map(renderSetupStep).join(' && ');
    let fullCmd = setup ? `${setup} && ${e2e.command}` : e2e.command;
    if (cwdInContainer !== '.') fullCmd = `cd ${cwdInContainer} && ${fullCmd}`;
    logger.debug(`Command: docker exec ${runnerContainer} sh -c ${JSON.stringify(fullCmd)}`);

    let execEnv =
      opts.e2eModules && opts.e2eModules.length
        ? ['-e', `CONTROL_E2E_MODULES=${opts.e2eModules.join(',')}`]
        : [];

    await runShell(['docker', 'exec', ...execEnv, runnerContainer, 'sh', '-c', fullCmd], {
      phase: 'test',
      service: serviceName,
      composeFile,
      keep: opts.keep,
      verbose: opts.verbose
    });
  } catch (err) {
    let phase = failedPhase;
    if (err instanceof DockerError) err.phase = phase;
    if (err instanceof HealthTimeoutError) (err as HealthTimeoutError & { failedPhase?: RunPhase }).failedPhase = phase;

    logger.warn('Fetching container logs...');
    await runShell(['docker', 'compose', '-p', projectName, '-f', composeFile, 'logs', '--tail=100'], {
      cwd: runDir,
      phase: failedPhase,
      service: serviceName,
      composeFile,
      keep: opts.keep,
      verbose: opts.verbose
    }).catch(() => {});

    logger.detail('Compose file', composeFile);
    if (!opts.keep) {
      logger.detail('Hint', 'Re-run with --keep to inspect containers after failure');
    }

    if (err instanceof Error) {
      (err as Error & { failedPhase?: RunPhase }).failedPhase = phase;
    }
    throw err;
  } finally {
    if (!opts.keep) {
      logger.debug('Tearing down stack...');
      await cleanupComposeStack(composeStack).catch(() => {});
      unregisterComposeStack(composeStack);
    }
  }
};

let getFailedPhase = (err: Error): string | undefined => {
  if ('failedPhase' in err && typeof (err as { failedPhase?: string }).failedPhase === 'string') {
    return (err as { failedPhase?: string }).failedPhase;
  }
  if (err instanceof DockerError) return err.phase;
  return undefined;
};

export let runControlBatch = async (
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
      await runControl({
        ...opts,
        target: service.relPath,
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
      mode: opts.mode,
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

export let runControlTargets = async (opts: RunOptions & { services: ControlService[] }) => {
  if (opts.mode === 'unit') {
    return runUnitTargets(opts);
  }

  let logger = createLogger(opts);
  let registry = getRegistry({
    cwd: resolveControlCwd(),
    entrypoint: opts.entrypoint,
    session: opts.session ?? null
  });
  let ordered = planExecutionOrder(opts.services, registry);

  logger.section(
    formatRunPlan({
      mode: opts.mode,
      controlRoot: registry.controlRoot,
      services: ordered
    })
  );
  logger.blank();

  if (ordered.length === 1) {
    await runControl({
      ...opts,
      target: ordered[0]!.relPath,
      context: { index: 1, total: 1, service: ordered[0]! }
    });
    return;
  }

  let result = await runControlBatch(opts);
  if (result.failed.length > 0) {
    process.exit(1);
  }
};
