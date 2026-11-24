import {
  createClusterManagerClient,
  type Build,
  type ClusterManagerClient
} from '@metorial-platform-systems/cluster-manager-client';
import { isServiceError } from '@lowerdeck/error';
import { createQueue, type IQueue, type IQueueProcessor } from '@lowerdeck/queue';
import { env } from '../../env';
import { parseBuildEgressPolicy } from '../../lib/buildEgressPolicy';
import {
  loadSigningKey,
  mintBuildGrant,
  type EgressPolicy,
  type SigningKey
} from '../../lib/egressGrant';
import { ForgeBuildAdapter } from '../_lib/adapter';
import { BuildContext } from '../_lib/buildContext';
import { applyBuildLog, type BuildLogState } from '../_lib/buildLog';
import type { ArtifactTarget } from '../_lib/buildScript';
import { admitKubernetesBuild } from './admission';
import { renderKubernetesBuild } from './script';

let LOG_PAGE_SIZE = 1000;
let GRACE_SECONDS = 5 * 60;
let MAX_LOG_DRAIN_MS = 30_000;
let RUNNING_POLL_MS = 2500;
let MAX_WAIT_POLL_MS = 30_000;
let RPC_TIMEOUT_MS = 10_000;

export type KubernetesBuildAdapterOpts = {
  client: Pick<ClusterManagerClient, 'build'>;
  signingKey: SigningKey;
  egressPolicy: EgressPolicy;
  timeoutSeconds: number;
  schedulingTimeoutSeconds: number;
  maxInFlight: number;
};

type StartBuildData = {
  runId: string;
  attempt?: number;
  pendingReason?: string;
  pendingCode?: string;
};

type MonitorBuildData = BuildLogState & {
  runId: string;
  artifactData: Record<string, ArtifactTarget>;
  setupStepOid: bigint;
  schedulingDeadlineAt?: number;
  deadlineAt?: number;
  cursor?: string;
  containerStartedAt?: number;
  pendingReason?: string | null;
  lastPendingReason?: string;
  lastPendingCode?: string;
  poll?: number;
  waitPoll?: number;
  drainingSince?: number;
};

type Failure = { code: string; message: string };

type BuildEndedData = {
  runId: string;
  artifactData: Record<string, ArtifactTarget>;
  logStepOid: bigint;
  build?: Build | null;
  failure?: Failure;
  buildStarted?: boolean;
  timedOut?: boolean;
  skipCleanup?: boolean;
  pendingReason?: string | null;
};

let isBuildNotFound = (err: unknown) =>
  isServiceError(err) && err.data.code === 'build_not_found';

let canRetry = (err: unknown) =>
  !isServiceError(err) || err.data.status === 429 || err.data.status >= 500;

let errorReason = (err: unknown) =>
  isServiceError(err)
    ? (err.data.reason ?? err.data.message)
    : 'Cluster manager is unavailable';

let isTerminal = (build: Build) => build.status === 'succeeded' || build.status === 'failed';

let waitDelay = (attempt: number) => {
  let ceiling = Math.min(MAX_WAIT_POLL_MS, 5000 * 2 ** Math.min(attempt, 3));
  return Math.floor(ceiling * (0.5 + Math.random() * 0.5));
};

let pendingMessage = (reason: string, code?: string) =>
  code === 'capacity' || code === 'quota' || code === 'admission_queue'
    ? `Waiting for build capacity: ${reason}`
    : `Waiting for the build to start: ${reason}`;

let schedulingFailure = (seconds: number, reason?: string | null, code?: string): Failure => {
  let capacity =
    code === 'capacity' ||
    code === 'quota' ||
    code === 'admission_queue' ||
    (!code && reason?.startsWith('Unschedulable'));
  let detail = reason ? ` Last reason: ${reason}` : '';
  if (code === 'infrastructure') {
    return {
      code: 'build_infrastructure_error',
      message: `Could not start the build within ${seconds} seconds.${detail}`
    };
  }
  return {
    code: capacity ? 'build_capacity_timeout' : 'build_startup_timeout',
    message: capacity
      ? `Timed out after ${seconds} seconds waiting for build capacity.${detail}`
      : `The build container did not start within ${seconds} seconds.${detail}`
  };
};

let runtimeFailure = (seconds: number): Failure => ({
  code: 'build_runtime_timeout',
  message: `Build timed out after ${seconds} seconds of execution`
});

let describeBuildFailure = (build: Build | null, data: BuildEndedData): Failure => {
  if (!build) {
    return { code: 'build_job_missing', message: 'Build no longer exists in the cluster' };
  }

  let reason = build.failureReason;
  let exit = build.exitCode == null ? '' : ` (exit code ${build.exitCode})`;
  if (reason?.startsWith('BackoffLimitExceeded') && build.exitCode != null) reason = null;

  let message = reason
    ? `${reason}${exit}`
    : `Build exited with code ${build.exitCode ?? 'unknown'}`;
  if (data.pendingReason && !data.buildStarted) {
    message += ` (the build never started: ${data.pendingReason})`;
  }

  return {
    code:
      build.failureCode ??
      (data.buildStarted === false ? 'build_startup_failed' : 'build_failed'),
    message
  };
};

let createDefaultOpts = (): KubernetesBuildAdapterOpts => ({
  client: createClusterManagerClient({
    endpoint: env.clusterManager.CLUSTER_MANAGER_URL!,
    tokenFile: env.clusterManager.CLUSTER_MANAGER_TOKEN_FILE
  }),
  signingKey: loadSigningKey(
    env.kubernetes.BUILD_SIGNING_KEY!,
    env.kubernetes.BUILD_SIGNING_KEY_ID
  ),
  egressPolicy: parseBuildEgressPolicy({
    hosts: env.kubernetes.BUILD_EGRESS_HOSTS,
    cidrs: env.kubernetes.BUILD_EGRESS_CIDRS
  }),
  timeoutSeconds: Math.floor(env.kubernetes.KUBERNETES_BUILD_TIMEOUT_SECONDS),
  schedulingTimeoutSeconds: env.kubernetes.KUBERNETES_BUILD_SCHEDULING_TIMEOUT_SECONDS,
  maxInFlight: env.kubernetes.KUBERNETES_BUILD_MAX_IN_FLIGHT
});

export class KubernetesBuildAdapter extends ForgeBuildAdapter {
  private readonly opts: KubernetesBuildAdapterOpts;

  constructor(opts?: KubernetesBuildAdapterOpts) {
    super();
    this.opts = opts ?? createDefaultOpts();
  }

  readonly startBuildQueue: IQueue<StartBuildData, any> = createQueue<StartBuildData>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/k8s/bld/start',
    workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
  });

  private readonly startBuildQueueProcessor = this.startBuildQueue.process(data =>
    this.startBuild(data.runId, data)
  );

  private readonly monitorBuildQueue = createQueue<MonitorBuildData>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/k8s/bld/mon',
    workerOpts: { concurrency: 10, limiter: { max: 20, duration: 1000 } }
  });

  private readonly buildEndedQueue = createQueue<BuildEndedData>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/k8s/bld/end',
    workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
  });

  private readonly monitorBuildQueueProcessor = this.monitorBuildQueue.process(async data => {
    let ctx = await BuildContext.of(data.runId);
    if (ctx.run.status === 'succeeded' || ctx.run.status === 'failed') return;

    let repoll = (delay: number) => {
      let poll = (data.poll ?? 0) + 1;
      return this.monitorBuildQueue.add(
        { ...data, poll },
        { id: `${data.runId}-${poll}`, delay }
      );
    };

    let ended = (build: Build | null, failure?: Failure) =>
      this.buildEndedQueue.add(
        {
          runId: data.runId,
          artifactData: data.artifactData,
          logStepOid: data.currentStepOid ?? data.setupStepOid,
          build,
          failure,
          buildStarted: data.buildStarted ?? false,
          pendingReason: data.lastPendingReason ?? data.pendingReason
        },
        { id: data.runId }
      );

    let now = Date.now();
    let schedulingDeadlineAt = data.schedulingDeadlineAt ?? data.deadlineAt!;
    let executionDeadline = () =>
      data.deadlineAt ??
      (data.containerStartedAt == null
        ? undefined
        : data.containerStartedAt + this.opts.timeoutSeconds * 1000);

    let build: Build | null;
    try {
      build = await this.getBuild(data.runId);
    } catch (err) {
      let deadline = executionDeadline() ?? schedulingDeadlineAt;
      if (!canRetry(err) || now >= deadline + GRACE_SECONDS * 1000) {
        await ended(null, {
          code: 'build_infrastructure_error',
          message: `Could not retrieve the build from Kubernetes. ${errorReason(err)}`
        });
        return;
      }
      let delay = waitDelay(data.waitPoll ?? 0);
      data.waitPoll = (data.waitPoll ?? 0) + 1;
      await repoll(delay);
      return;
    }

    if (!build) {
      await ended(null);
      return;
    }

    let terminal = isTerminal(build);
    if (build.status !== 'pending' && build.startedAt && data.containerStartedAt == null) {
      data.containerStartedAt = new Date(build.startedAt).getTime();
      if (
        !terminal &&
        (data.deadlineAt != null || data.containerStartedAt <= schedulingDeadlineAt)
      ) {
        await ctx.startRun({ startedAt: new Date(data.containerStartedAt) });
      }
    }

    let waitReason = build.status === 'pending' ? build.pendingReason : null;
    if (!terminal && waitReason !== (data.pendingReason ?? null)) {
      let message = waitReason ? pendingMessage(waitReason, build.pendingCode) : null;
      await ctx.setPendingReason({ pendingReason: message });
      if (message) {
        await ctx.storeTempOutput({
          stepOid: data.setupStepOid,
          message: JSON.stringify([now, message])
        });
      }
      data.pendingReason = waitReason;
      data.waitPoll = 0;
    }
    if (waitReason) {
      data.lastPendingReason = waitReason;
      data.lastPendingCode = build.pendingCode;
    }

    let deadline = executionDeadline();
    let started =
      data.containerStartedAt != null || data.buildStarted || build.status === 'running';
    let startedLate =
      data.deadlineAt == null &&
      data.containerStartedAt != null &&
      data.containerStartedAt > schedulingDeadlineAt;
    let waitingExpired = !started && now >= schedulingDeadlineAt;
    let jobDeadline = build.failureCode === 'build_deadline_exceeded';
    let failure =
      startedLate || (waitingExpired && (!terminal || jobDeadline))
        ? schedulingFailure(
            this.opts.schedulingTimeoutSeconds,
            data.lastPendingReason,
            data.lastPendingCode
          )
        : undefined;

    let expiredDuringExecution =
      deadline != null &&
      ((!terminal && now >= deadline) ||
        (build.status === 'failed' &&
          build.failureCode == null &&
          build.finishedAt &&
          (build.exitCode === 124 || build.exitCode === 137) &&
          new Date(build.finishedAt).getTime() >= deadline));
    if (!failure && (expiredDuringExecution || (started && jobDeadline))) {
      failure = runtimeFailure(this.opts.timeoutSeconds);
    }

    let hasMore = false;
    if (build.status !== 'pending' && build.failureCode !== 'build_admission_rejected') {
      let logs: Awaited<ReturnType<ClusterManagerClient['build']['logs']>> | undefined;
      try {
        logs = await this.opts.client.build.logs(
          { runId: data.runId, cursor: data.cursor, limit: LOG_PAGE_SIZE },
          { timeoutMs: RPC_TIMEOUT_MS }
        );
      } catch (err) {
        if (!terminal && !failure) {
          let delay = waitDelay(data.waitPoll ?? 0);
          data.waitPoll = (data.waitPoll ?? 0) + 1;
          await repoll(delay);
          return;
        }
        data.drainingSince ??= now;
        if (canRetry(err) && now < data.drainingSince + MAX_LOG_DRAIN_MS) {
          await repoll(RUNNING_POLL_MS);
          return;
        }
        await ctx.storeTempOutput({
          stepOid: data.currentStepOid ?? data.setupStepOid,
          message: JSON.stringify([
            now,
            'Some build logs could not be collected from Kubernetes'
          ])
        });
      }

      if (logs) {
        await applyBuildLog({
          ctx,
          state: data,
          artifactData: data.artifactData,
          startupStepOid: data.setupStepOid,
          lines: logs.lines.map(line => ({
            timestamp: new Date(line.ts).getTime(),
            message: line.line
          }))
        });
        data.cursor = logs.nextCursor || data.cursor;
        hasMore = logs.lines.length >= LOG_PAGE_SIZE;
      }
    }

    if ((terminal || failure) && (!hasMore || !terminal)) {
      await ended(build, failure);
      return;
    }

    let pending = build.status === 'pending';
    let delay = pending
      ? Math.min(waitDelay(data.waitPoll ?? 0), Math.max(0, schedulingDeadlineAt - now))
      : RUNNING_POLL_MS;
    data.waitPoll = pending ? (data.waitPoll ?? 0) + 1 : 0;
    await repoll(hasMore ? 500 : delay);
  });

  private readonly buildEndedQueueProcessor = this.buildEndedQueue.process(async data => {
    let ctx = await BuildContext.of(data.runId);
    if (ctx.run.status !== 'failed' && ctx.run.status !== 'succeeded') {
      let build = data.build === undefined ? await this.getBuild(data.runId) : data.build;
      let failure =
        data.failure ?? (data.timedOut ? runtimeFailure(this.opts.timeoutSeconds) : undefined);
      if (!failure && build?.status !== 'succeeded') {
        failure = describeBuildFailure(build, data);
      }

      if (failure) {
        failure.message = failure.message.slice(0, 2000);
        await ctx.storeTempOutput({
          stepOid: data.logStepOid,
          message: JSON.stringify([Date.now(), `Build failed: ${failure.message}`])
        });
      }

      await ctx.completeBuild({
        status: failure ? 'failed' : 'succeeded',
        failure,
        stepArtifacts: Object.entries(data.artifactData).map(([stepId, info]) => ({
          stepId,
          ...info
        }))
      });
    }

    if (data.skipCleanup) return;

    try {
      await this.opts.client.build.delete({ runId: data.runId });
    } catch (err) {
      if (!isBuildNotFound(err)) throw err;
    }
  });

  readonly buildProviderProcessors: IQueueProcessor = this.combineProcessors([
    this.startBuildQueueProcessor,
    this.monitorBuildQueueProcessor,
    this.buildEndedQueueProcessor
  ]);

  async startBuild(runId: string, state: StartBuildData = { runId }) {
    let ctx = await BuildContext.of(runId);
    if (ctx.run.status === 'succeeded' || ctx.run.status === 'failed') return;

    let admission = await admitKubernetesBuild(
      ctx.run,
      this.opts.schedulingTimeoutSeconds * 1000,
      this.opts.maxInFlight
    );
    if (admission.status === 'finished') return;

    let reschedule = async (reason: string, code: string) => {
      let pendingReason = pendingMessage(reason, code);
      await ctx.setPendingReason({ pendingReason });
      let attempt = (state.attempt ?? 0) + 1;
      let delay = Math.min(
        waitDelay(attempt - 1),
        Math.max(0, admission.deadline - Date.now())
      );
      await this.startBuildQueue.add(
        { runId, attempt, pendingReason: reason, pendingCode: code },
        { id: `${runId}-${attempt}`, delay }
      );
    };

    if (admission.status === 'waiting') {
      await reschedule(
        'All configured build slots are occupied or reserved for earlier builds',
        'admission_queue'
      );
      return;
    }

    let run = await this.resolveBuildRun(runId);
    let fail = async (failure: Failure, skipCleanup = false) => {
      await this.buildEndedQueue.add(
        {
          runId,
          artifactData: {},
          logStepOid: run.setupStep.oid,
          build: null,
          failure,
          skipCleanup
        },
        { id: runId }
      );
    };

    if (admission.status === 'expired') {
      await fail(
        schedulingFailure(
          this.opts.schedulingTimeoutSeconds,
          state.pendingReason ?? 'No build slot became available',
          state.pendingCode ?? 'admission_queue'
        ),
        true
      );
      return;
    }

    let tenant = await ctx.getTenant();
    let rendered = await renderKubernetesBuild({
      run,
      allocateUpload: stepId => ctx.getArtifactUploadTarget(stepId)
    });

    let now = Date.now();
    let issuedAt = Math.floor(now / 1000);
    let timeoutSeconds = this.opts.timeoutSeconds;
    let remainingWaitSeconds = Math.max(0, Math.ceil((admission.deadline - now) / 1000));
    if (remainingWaitSeconds === 0) {
      let build: Build | null;
      try {
        build = await this.getBuild(runId);
      } catch (err) {
        if (!canRetry(err)) throw err;
        await fail(
          schedulingFailure(
            this.opts.schedulingTimeoutSeconds,
            errorReason(err),
            'infrastructure'
          )
        );
        return;
      }

      if (!build) {
        await fail(
          schedulingFailure(
            this.opts.schedulingTimeoutSeconds,
            state.pendingReason,
            state.pendingCode
          )
        );
        return;
      }
    } else {
      let egressGrant = mintBuildGrant(this.opts.signingKey, {
        buildRunId: runId,
        tenantId: tenant.id,
        policy: this.opts.egressPolicy,
        issuedAt,
        expiresAt: issuedAt + remainingWaitSeconds + timeoutSeconds + GRACE_SECONDS
      });

      try {
        await this.opts.client.build.start(
          {
            runId,
            image: 'build-ubuntu',
            script: rendered.script,
            env: run.runtimeEnv,
            downloads: rendered.downloads,
            uploads: rendered.uploads,
            timeoutSeconds,
            schedulingTimeoutSeconds: remainingWaitSeconds,
            egressGrant
          },
          { timeoutMs: Math.min(RPC_TIMEOUT_MS, remainingWaitSeconds * 1000) }
        );
      } catch (err) {
        let reason = errorReason(err);
        if (canRetry(err)) {
          let quota = isServiceError(err) && err.data.code === 'build_quota_exceeded';
          await reschedule(reason, quota ? 'quota' : 'infrastructure');
        } else {
          await fail({ code: 'build_admission_rejected', message: reason });
        }
        return;
      }
    }

    if (state.pendingReason) await ctx.setPendingReason({ pendingReason: null });

    await this.monitorBuildQueue.add(
      {
        runId,
        artifactData: rendered.artifactData,
        setupStepOid: run.setupStep.oid,
        schedulingDeadlineAt: admission.deadline
      },
      {
        id: `${runId}-0`,
        delay: 1000,
        deduplication: {
          id: runId,
          ttl: (this.opts.schedulingTimeoutSeconds + timeoutSeconds + GRACE_SECONDS) * 1000
        }
      }
    );
  }

  private async getBuild(runId: string) {
    try {
      return await this.opts.client.build.get({ runId }, { timeoutMs: RPC_TIMEOUT_MS });
    } catch (err) {
      if (isBuildNotFound(err)) return null;
      throw err;
    }
  }
}
