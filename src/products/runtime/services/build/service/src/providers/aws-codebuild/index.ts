import { GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { BatchGetBuildsCommand, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { createQueue, type IQueue, type IQueueProcessor } from '@lowerdeck/queue';
import { stringify } from 'yaml';
import { env } from '../../env';
import { storage } from '../../storage';
import { ForgeBuildAdapter } from '../_lib/adapter';
import { BuildContext } from '../_lib/buildContext';
import { applyBuildLog } from '../_lib/buildLog';
import { echoSystemMarker, renderBuildCommands, shellEscape } from '../_lib/buildScript';
import { checkCodeBuildAccess } from './access';
import { createBuildLookup } from './buildLookup';
import { codebuild, logsClient } from './codeBuild';
import { ensureProject } from './project';

let SIGNED_URL_EXPIRATION_SECS = 60 * 60 * 6;

let getBuild = createBuildLookup({
  fetchBuilds: async ids => {
    if (!codebuild) throw new Error('CodeBuild client not initialized');

    let res = await codebuild.send(new BatchGetBuildsCommand({ ids }));
    return res.builds ?? [];
  }
});

export class AwsCodeBuildAdapter extends ForgeBuildAdapter {
  readonly startBuildQueue: IQueue<{ runId: string }, any> = createQueue<{ runId: string }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/aws.cb/bld/start',
    workerOpts: {
      concurrency: 5,
      limiter: {
        max: 1,
        duration: 1000
      }
    }
  });

  private readonly startBuildQueueProcessor = this.createStartBuildProcessor();

  private readonly waitForBuildQueue = createQueue<{
    runId: string;
    buildId: string;
    attemptNo: number;
    artifactData: Record<string, { bucket: string; storageKey: string }>;
  }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/aws.cb/bld/wait',
    workerOpts: {
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  });

  private readonly startedBuildQueue = createQueue<{
    runId: string;
    buildId: string;
    cloudwatch: { groupName: string; streamName: string };
    artifactData: Record<string, { bucket: string; storageKey: string }>;
  }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/aws.cb/bld/started',
    workerOpts: {
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  });

  private readonly monitorBuildOutputQueue = createQueue<{
    runId: string;
    runOid: bigint;
    buildId: string;
    cloudwatch: { groupName: string; streamName: string };
    nextToken?: string;
    buildStarted?: boolean;
    buildEnded?: boolean;
    currentStepOid?: bigint;
    artifactData: Record<string, { bucket: string; storageKey: string }>;
    afterCheckNo?: number;
  }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/aws.cb/bld/mopt',
    workerOpts: {
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  });

  private readonly buildEndedQueue = createQueue<{
    runId: string;
    buildId: string;
    artifactData: Record<string, { bucket: string; storageKey: string }>;
  }>({
    redisUrl: env.service.REDIS_URL,
    name: 'frg/aws.cb/bld/end',
    workerOpts: {
      concurrency: 5,
      limiter: {
        max: 1,
        duration: 1000
      }
    }
  });

  private readonly waitForBuildQueueProcessor = this.waitForBuildQueue.process(async data => {
    if (!codebuild) throw new Error('CodeBuild client not initialized');

    let build = await getBuild(data.buildId);
    if (!build) return;

    let ended =
      build.buildStatus == 'FAILED' ||
      build.buildStatus == 'FAULT' ||
      build.buildStatus == 'STOPPED' ||
      build.buildStatus == 'SUCCEEDED' ||
      build.buildStatus == 'TIMED_OUT';
    let inProgress =
      build.buildStatus == 'IN_PROGRESS' && build.logs?.streamName && build.logs?.groupName;

    if (ended) {
      await this.buildEndedQueue.add(data);
    } else if (inProgress) {
      await this.startedBuildQueue.add({
        ...data,
        cloudwatch: {
          groupName: build.logs!.groupName!,
          streamName: build.logs!.streamName!
        }
      });
    } else {
      await this.waitForBuildQueue.add(
        {
          ...data,
          attemptNo: data.attemptNo + 1
        },
        { delay: data.attemptNo < 10 ? 2500 : 5000 }
      );
    }
  });

  private readonly startedBuildQueueProcessor = this.startedBuildQueue.process(async data => {
    if (!codebuild) throw new Error('CodeBuild client not initialized');

    let build = await getBuild(data.buildId);
    if (!build) return;

    let ctx = await BuildContext.of(data.runId);

    await this.monitorBuildOutputQueue.add({
      ...data,
      runOid: ctx.run.oid
    });
  });

  private readonly monitorBuildOutputQueueProcessor = this.monitorBuildOutputQueue.process(
    async data => {
      if (!logsClient || !codebuild) throw new Error('CodeBuild client not initialized');

      let ctx = await BuildContext.of(data.runId);

      let build = await getBuild(data.buildId);
      if (!build) return;

      let logResp = await logsClient.send(
        new GetLogEventsCommand({
          logGroupName: data.cloudwatch.groupName,
          logStreamName: data.cloudwatch.streamName,
          nextToken: data.nextToken,
          startFromHead: true,
          limit: 1000
        })
      );

      let events = logResp.events || [];
      let hasManyEvents = events.length >= 500;

      await applyBuildLog({
        ctx,
        state: data,
        artifactData: data.artifactData,
        lines: events
          .map(event => ({ timestamp: event.timestamp, message: event.message || '' }))
          .filter(line => !line.message.trim().startsWith('[Container]'))
      });

      let finalAfterCheckNo = data.afterCheckNo !== undefined && data.afterCheckNo >= 5;

      if (data.buildEnded || finalAfterCheckNo) {
        await this.buildEndedQueue.add({
          runId: data.runId,
          buildId: data.buildId,
          artifactData: data.artifactData
        });
        return;
      }

      let buildEndedUnexpectedly = build.buildStatus != 'IN_PROGRESS';
      data.buildEnded = data.buildEnded || buildEndedUnexpectedly;

      let afterCheckNo = buildEndedUnexpectedly ? (data.afterCheckNo || 0) + 1 : undefined;

      if (logResp.nextForwardToken) {
        await this.monitorBuildOutputQueue.add(
          {
            ...data,
            nextToken: logResp.nextForwardToken,
            afterCheckNo
          },
          { delay: hasManyEvents ? 500 : 2500 }
        );
      } else {
        await this.buildEndedQueue.add(
          { runId: data.runId, buildId: data.buildId, artifactData: data.artifactData },
          { delay: 5000 }
        );
      }
    }
  );

  private readonly buildEndedQueueProcessor = this.buildEndedQueue.process(async data => {
    if (!codebuild) throw new Error('CodeBuild client not initialized');

    let build = await getBuild(data.buildId);
    if (!build) return;

    let terminalStatuses = ['FAILED', 'FAULT', 'STOPPED', 'SUCCEEDED', 'TIMED_OUT'] as const;

    if (!build.buildStatus || !terminalStatuses.includes(build.buildStatus as any)) {
      await this.buildEndedQueue.add(data, { delay: 3000 });
      return;
    }

    let ctx = await BuildContext.of(data.runId);

    await ctx.completeBuild({
      status: build.buildStatus == 'SUCCEEDED' ? 'succeeded' : 'failed',
      stepArtifacts: Object.entries(data.artifactData).map(([stepId, info]) => ({
        stepId,
        ...info
      }))
    });
  });

  readonly buildProviderProcessors: IQueueProcessor = this.combineProcessors([
    this.startBuildQueueProcessor,
    this.waitForBuildQueueProcessor,
    this.startedBuildQueueProcessor,
    this.monitorBuildOutputQueueProcessor,
    this.buildEndedQueueProcessor
  ]);

  async startBuild(runId: string) {
    if (!codebuild) throw new Error('CodeBuild client not initialized');

    let run = await this.resolveBuildRun(runId);
    let project = await ensureProject();

    try {
      let { commands, artifactData } = await renderBuildCommands(run, {
        runner: 'AWS/1',
        setupCommands: ['apt-get update && apt-get install -y zip unzip curl'],
        logSystem: echoSystemMarker,
        downloadArtifact: async ({ artifact, outputPath }) => {
          let res = await storage.getPublicURL(
            artifact.bucket,
            artifact.storageKey,
            SIGNED_URL_EXPIRATION_SECS
          );

          return `curl -sL ${shellEscape(res.url)} -o ${outputPath}`;
        },
        uploadArtifact: async ({ path }) => {
          let uploadInfo = await run.ctx.getArtifactUploadInfo();
          let headers = Object.entries(uploadInfo.uploadHeaders)
            .map(([name, value]) => `-H ${shellEscape(`${name}: ${value}`)} `)
            .join('');

          return {
            target: { bucket: uploadInfo.bucket, storageKey: uploadInfo.storageKey },
            command: `curl -X PUT ${shellEscape(uploadInfo.uploadUrl)} -H "Content-Type: application/octet-stream" ${headers}--data-binary @${shellEscape(path)} `
          };
        }
      });

      let startBuildResp = await codebuild.send(
        new StartBuildCommand({
          projectName: project.projectName,
          environmentVariablesOverride: Object.entries(run.runtimeEnv).map(([k, v]) => ({
            name: k,
            value: v,
            type: 'PLAINTEXT' as const
          })),
          buildspecOverride: stringify({
            version: '0.2',
            phases: { build: { commands } }
          })
        })
      );

      await this.waitForBuildQueue.add({
        runId: run.ctx.run.id,
        buildId: startBuildResp.build?.id!,
        attemptNo: 1,
        artifactData
      });
    } catch (err: any) {
      let message = String(err?.message ?? err?.toString?.() ?? '');

      if (
        message.includes('Concurrent build limit') ||
        message.includes('Throttling') ||
        message.includes('Rate exceeded') ||
        message.includes('LimitExceeded')
      ) {
        await this.startBuildQueue.add({ runId }, { delay: 30_000 });
        return;
      }

      throw err;
    }
  }
}

if (
  process.env.NODE_ENV == 'production' &&
  process.env.DEFAULT_PROVIDER === 'aws.code-build'
) {
  await checkCodeBuildAccess();
}
