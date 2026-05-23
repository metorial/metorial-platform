import { GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { BatchGetBuildsCommand, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { createQueue, type IQueue, type IQueueProcessor } from '@mtsrc/queue';
import { stringify } from 'yaml';
import { env } from '../../env';
import { storage } from '../../storage';
import { ForgeBuildAdapter } from '../_lib/adapter';
import { BuildContext } from '../_lib/buildContext';
import { checkCodeBuildAccess } from './access';
import { codebuild, logsClient } from './codeBuild';
import { ensureProject } from './project';

let SYSTEM_OUTPUT_PREFIX = `X@%%MT0RL-)AL:: `;

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

    let buildInfo = await codebuild.send(
      new BatchGetBuildsCommand({
        ids: [data.buildId]
      })
    );
    let build = buildInfo.builds?.[0];
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

    let buildInfo = await codebuild.send(
      new BatchGetBuildsCommand({
        ids: [data.buildId]
      })
    );
    let build = buildInfo.builds?.[0];
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

      let buildInfo = await codebuild.send(
        new BatchGetBuildsCommand({
          ids: [data.buildId]
        })
      );
      let build = buildInfo.builds?.[0];
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

      let collectedMessages = new Map<bigint, string>();
      let events = logResp.events || [];
      let hasManyEvents = events.length >= 500;

      for (let event of events) {
        let message = (event.message || '').trim();
        if (message.startsWith('[Container]')) continue;

        let systemLog = this.parseSystemLog(message);

        if (systemLog) {
          if (systemLog.type === 'build.start') {
            await ctx.startRun({
              startedAt: event.timestamp ? new Date(event.timestamp) : new Date()
            });
            data.buildStarted = true;
          } else if (systemLog.type === 'build.end') {
            data.buildEnded = true;
          } else if (systemLog.type === 'step.start') {
            let step = await ctx.startStep({
              stepId: systemLog.stepId,
              startedAt: event.timestamp ? new Date(event.timestamp) : new Date()
            });
            data.currentStepOid = step.oid;
          } else if (systemLog.type === 'step.end') {
            let step = await ctx.completeStep({
              stepId: systemLog.stepId,
              status: 'succeeded',
              endedAt: event.timestamp ? new Date(event.timestamp) : new Date()
            });
            if (data.currentStepOid === step.oid) data.currentStepOid = undefined;
          } else if (systemLog.type === 'upload-artifact.register') {
            let step = await ctx.getStepById(systemLog.stepId);
            let artifactData = step ? data.artifactData[step.id] : null;

            if (artifactData && step) {
              await ctx.completeArtifactUpload({
                step,
                artifactData
              });
            }
          }
        } else if (data.buildStarted && !data.buildEnded && data.currentStepOid) {
          let string = collectedMessages.get(data.currentStepOid) || '';
          string += JSON.stringify([event.timestamp || 0, message]) + '\n';
          collectedMessages.set(data.currentStepOid, string);
        }
      }

      for (let [stepOid, msg] of collectedMessages.entries()) {
        await ctx.storeTempOutput({
          stepOid,
          message: msg
        });
      }

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

    let buildInfo = await codebuild.send(
      new BatchGetBuildsCommand({
        ids: [data.buildId]
      })
    );
    let build = buildInfo.builds?.[0];
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
    let artifactData: Record<string, { bucket: string; storageKey: string }> = {};

    try {
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
            phases: {
              build: {
                commands: [
                  this.logSystem({ type: 'build.start' }),
                  this.logSystem({ type: 'step.start', stepId: run.setupStep.id }),
                  'echo "Started build on Metorial Forge (runner: AWS/1) ..."',
                  'echo "Setting up build environment ..."',
                  'apt-get update && apt-get install -y zip unzip curl',
                  'mkdir -p ./forge',
                  'cd ./forge',
                  'mkdir -p ./output',
                  this.logSystem({ type: 'download-artifacts.start' }),
                  'echo "Downloading initial files ..."',
                  ...(
                    await Promise.all(
                      run.artifacts.map(async artifact => {
                        let res = await storage.getPublicURL(
                          artifact.bucket,
                          artifact.storageKey,
                          60 * 60 * 6
                        );

                        return [
                          this.logSystem({
                            type: 'download-artifact.start',
                            artifactId: artifact.id
                          }),
                          `curl -sL ${this.shellEscape(res.url)} -o /tmp/artifact_${artifact.oid}.zip`,
                          `unzip -o /tmp/artifact_${artifact.oid}.zip -d ./`,
                          `rm /tmp/artifact_${artifact.oid}.zip`,
                          this.logSystem({
                            type: 'download-artifact.end',
                            artifactId: artifact.id
                          })
                        ];
                      })
                    )
                  ).flat(),
                  this.logSystem({ type: 'download-artifacts.end' }),
                  'echo "Build environment setup complete."',
                  this.logSystem({ type: 'step.end', stepId: run.setupStep.id }),
                  ...run.initSteps.flatMap(step => [
                    this.logSystem({ type: 'step.start', stepId: step.id }),
                    ...(step.step?.initScript ?? ['echo "No action"']),
                    this.logSystem({ type: 'step.end', stepId: step.id })
                  ]),
                  ...(
                    await Promise.all(
                      run.actionSteps.flatMap(async step => {
                        let inner: string[] = [];

                        if (step.step?.type == 'script') {
                          inner = step.step.actionScript ?? ['echo "No action"'];
                        } else if (step.step?.type == 'download_artifact') {
                          let artifact = step.step.artifactToDownload;
                          if (!artifact) {
                            throw new Error('Artifact to download not found');
                          }

                          let res = await storage.getPublicURL(
                            artifact.bucket,
                            artifact.storageKey,
                            60 * 60 * 6
                          );

                          inner = [
                            `echo "Downloading artifact ${artifact.name} ..."`,
                            `curl -sL ${this.shellEscape(res.url)} -o /tmp/artifact_${artifact.oid}`,
                            `mv /tmp/artifact_${artifact.oid} ${this.shellEscape(step.step.artifactToDownloadPath!)}`,
                            'echo "Download complete."'
                          ];
                        } else if (step.step?.type == 'upload_artifact') {
                          let uploadInfo = await run.ctx.getArtifactUploadInfo();

                          artifactData[step.id] = {
                            bucket: uploadInfo.bucket,
                            storageKey: uploadInfo.storageKey
                          };

                          inner = [
                            `echo "Uploading artifact ${step.step.artifactToUploadName!} from ${step.step.artifactToUploadPath!} ..."`,
                            `curl -X PUT ${this.shellEscape(uploadInfo.uploadUrl)} -H "Content-Type: application/octet-stream" --data-binary @${this.shellEscape(step.step.artifactToUploadPath!)} `,
                            'echo "Upload complete."',
                            this.logSystem({
                              type: 'upload-artifact.register',
                              stepId: step.id
                            })
                          ];
                        }

                        return [
                          this.logSystem({ type: 'step.start', stepId: step.id }),
                          ...inner,
                          this.logSystem({ type: 'step.end', stepId: step.id })
                        ];
                      })
                    )
                  ).flat(),
                  ...run.cleanupSteps.flatMap(step => [
                    this.logSystem({ type: 'step.start', stepId: step.id }),
                    ...(step.step?.cleanupScript ?? ['echo "No action"']),
                    this.logSystem({ type: 'step.end', stepId: step.id })
                  ]),
                  this.logSystem({ type: 'step.start', stepId: run.teardownStep.id }),
                  'echo "Tearing down build environment ..."',
                  'echo "Build complete ... powered by Metorial Forge (AWS/1)."',
                  this.logSystem({ type: 'step.end', stepId: run.teardownStep.id }),
                  this.logSystem({ type: 'build.end' })
                ]
              }
            }
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

  private shellEscape(str: string) {
    return `'${str.replace(/'/g, `'\\''`)}'`;
  }

  private logSystem(data: any) {
    return `echo ${this.shellEscape(SYSTEM_OUTPUT_PREFIX + JSON.stringify(data))}`;
  }

  private parseSystemLog(line: string) {
    let idx = line.indexOf(SYSTEM_OUTPUT_PREFIX);
    if (idx === -1) return null;
    let json = line.slice(idx + SYSTEM_OUTPUT_PREFIX.length);
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

if (
  process.env.NODE_ENV == 'production' &&
  process.env.DEFAULT_PROVIDER === 'aws.code-build'
) {
  await checkCodeBuildAccess();
}
