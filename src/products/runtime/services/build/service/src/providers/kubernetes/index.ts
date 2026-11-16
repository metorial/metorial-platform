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
import { applyBuildLog } from '../_lib/buildLog';
import type { ArtifactTarget } from '../_lib/buildScript';
import { renderKubernetesBuild } from './script';

let LOG_PAGE_SIZE = 1000;
let GRANT_GRACE_SECONDS = 5 * 60;
let MONITOR_GRACE_SECONDS = 5 * 60;

export type KubernetesBuildAdapterOpts = {
  client: Pick<ClusterManagerClient, 'build'>;
  signingKey: SigningKey;
  egressPolicy: EgressPolicy;
  timeoutSeconds: number;
};

type MonitorBuildData = {
  runId: string;
  artifactData: Record<string, ArtifactTarget>;
  setupStepOid: bigint;
  deadlineAt: number;
  cursor?: string;
  buildStarted?: boolean;
  buildEnded?: boolean;
  currentStepOid?: bigint;
};

type BuildEndedData = {
  runId: string;
  artifactData: Record<string, ArtifactTarget>;
  logStepOid: bigint;
  timedOut?: boolean;
};

let isBuildNotFound = (err: unknown) =>
  isServiceError(err) && err.data.code == 'build_not_found';

let isClientError = (err: unknown) =>
  isServiceError(err) && err.data.status >= 400 && err.data.status < 500;

let isTerminal = (build: Build) => build.status == 'succeeded' || build.status == 'failed';

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
  timeoutSeconds: Math.floor(env.kubernetes.KUBERNETES_BUILD_TIMEOUT_SECONDS)
});

export class KubernetesBuildAdapter extends ForgeBuildAdapter {
  private readonly opts: KubernetesBuildAdapterOpts;

  constructor(opts?: KubernetesBuildAdapterOpts) {
    super();
    this.opts = opts ?? createDefaultOpts();
  }

  readonly startBuildQueue: IQueue<{ runId: string }, any> = createQueue<{ runId: string }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/k8s/bld/start',
    workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
  });

  private readonly startBuildQueueProcessor = this.createStartBuildProcessor();

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
    let ended = (timedOut?: boolean) =>
      this.buildEndedQueue.add({
        runId: data.runId,
        artifactData: data.artifactData,
        logStepOid: data.currentStepOid ?? data.setupStepOid,
        timedOut
      });

    let ctx = await BuildContext.of(data.runId);

    let build = await this.getBuild(data.runId);
    if (!build) {
      await ended();
      return;
    }

    let logs = await this.opts.client.build.logs({
      runId: data.runId,
      cursor: data.cursor,
      limit: LOG_PAGE_SIZE
    });

    await applyBuildLog({
      ctx,
      state: data,
      artifactData: data.artifactData,
      lines: logs.lines.map(line => ({
        timestamp: new Date(line.ts).getTime(),
        message: line.line
      }))
    });

    let hasMore = logs.lines.length >= LOG_PAGE_SIZE;

    if (isTerminal(build) && !hasMore) {
      await ended();
      return;
    }

    if (!isTerminal(build) && Date.now() > data.deadlineAt) {
      await ended(true);
      return;
    }

    await this.monitorBuildQueue.add(
      { ...data, cursor: logs.nextCursor || data.cursor },
      { delay: hasMore ? 500 : 2500 }
    );
  });

  private readonly buildEndedQueueProcessor = this.buildEndedQueue.process(async data => {
    let ctx = await BuildContext.of(data.runId);
    let build = await this.getBuild(data.runId);
    let succeeded = !data.timedOut && build?.status == 'succeeded';

    if (!succeeded) {
      let reason = data.timedOut
        ? `Build timed out after ${this.opts.timeoutSeconds} seconds`
        : !build
          ? 'Build no longer exists in the cluster'
          : (build.failureReason ?? `Build exited with code ${build.exitCode ?? 'unknown'}`);

      await ctx.storeTempOutput({
        stepOid: data.logStepOid,
        message: JSON.stringify([Date.now(), `Build failed: ${reason}`])
      });
    }

    await ctx.completeBuild({
      status: succeeded ? 'succeeded' : 'failed',
      stepArtifacts: Object.entries(data.artifactData).map(([stepId, info]) => ({
        stepId,
        ...info
      }))
    });

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

  async startBuild(runId: string) {
    let run = await this.resolveBuildRun(runId);
    let tenant = await run.ctx.getTenant();

    let rendered = await renderKubernetesBuild({
      run,
      allocateUpload: stepId => run.ctx.getArtifactUploadTarget(stepId)
    });

    let startedAt = Date.now();
    let issuedAt = Math.floor(startedAt / 1000);
    let timeoutSeconds = this.opts.timeoutSeconds;

    let egressGrant = mintBuildGrant(this.opts.signingKey, {
      buildRunId: run.ctx.run.id,
      tenantId: tenant.id,
      policy: this.opts.egressPolicy,
      issuedAt,
      expiresAt: issuedAt + timeoutSeconds + GRANT_GRACE_SECONDS
    });

    try {
      await this.opts.client.build.start({
        runId: run.ctx.run.id,
        image: 'build-ubuntu',
        script: rendered.script,
        env: run.runtimeEnv,
        downloads: rendered.downloads,
        uploads: rendered.uploads,
        timeoutSeconds,
        egressGrant
      });
    } catch (err) {
      if (!isClientError(err)) throw err;

      let step = await run.ctx.startStep({ stepId: run.setupStep.id });
      let logger = this.createStepLogger(run.ctx, step.oid);
      await logger.writeLine(`Build failed: ${this.toErrorMessage(err)}`);
      await logger.flush();

      await this.failBuild(run.ctx, err, 'Kubernetes forge build was rejected');
      return;
    }

    await this.monitorBuildQueue.add(
      {
        runId: run.ctx.run.id,
        artifactData: rendered.artifactData,
        setupStepOid: run.setupStep.oid,
        deadlineAt: startedAt + (timeoutSeconds + MONITOR_GRACE_SECONDS) * 1000
      },
      { delay: 1000 }
    );
  }

  private async getBuild(runId: string) {
    try {
      return await this.opts.client.build.get({ runId });
    } catch (err) {
      if (isBuildNotFound(err)) return null;
      throw err;
    }
  }
}
