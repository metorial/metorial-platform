import { GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { BatchGetBuildsCommand, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { stringify } from 'yaml';
import { env } from '../../env';
import { storage } from '../../storage';
import { BuildContext } from '../_lib/buildContext';
import { checkCodeBuildAccess } from './access';
import { codebuild, logsClient } from './codeBuild';
import { ensureProject } from './project';

const SYSTEM_OUTPUT_PREFIX = `X@%%MT0RL-)AL:: `;

let shellEscape = (str: string) => `'${str.replace(/'/g, `'\\''`)}'`;
let logSystem = (data: any) =>
  `echo ${shellEscape(SYSTEM_OUTPUT_PREFIX + JSON.stringify(data))}`;
let parseSystemLog = (line: string) => {
  let idx = line.indexOf(SYSTEM_OUTPUT_PREFIX);
  if (idx === -1) return null;
  let json = line.slice(SYSTEM_OUTPUT_PREFIX.length);
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export let startAwsCodeBuildQueue = createQueue<{ runId: string }>({
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

let startBuildQueueProcessor = startAwsCodeBuildQueue.process(async data => {
  if (!codebuild) throw new Error('CodeBuild client not initialized');

  let ctx = await BuildContext.of(data.runId);
  let version = await ctx.getVersion();

  let project = await ensureProject();

  let steps = await ctx.listSteps();
  let artifacts = await ctx.listArtifacts();

  let setupStep = steps.find(s => s.type === 'setup')!;
  let teardownStep = steps.find(s => s.type === 'teardown')!;

  let initSteps = steps.filter(s => s.type === 'init');
  let actionSteps = steps.filter(s => s.type === 'action');
  let cleanupSteps = steps.filter(s => s.type === 'cleanup');

  let artifactData: Record<string, { bucket: string; storageKey: string }> = {};

  let envVars = await ctx.DANGEROUSLY_getDecryptedEnvVars();

  try {
    let startBuildResp = await codebuild.send(
      new StartBuildCommand({
        projectName: project.projectName,
        environmentVariablesOverride: [
          ...Object.entries({
            ...envVars,
            WORKFLOW_RUN_ID: ctx.run.id,
            WORKFLOW_VERSION_ID: version.id,
            RUNTIME: 'metorial-forge@1.0.0'
          }).map(([k, v]) => ({
            name: k,
            value: v,
            type: 'PLAINTEXT' as const
          }))
        ],

        buildspecOverride: stringify({
          version: '0.2',
          phases: {
            build: {
              commands: [
                logSystem({ type: 'build.start' }),

                logSystem({ type: 'step.start', stepId: setupStep.id }),

                'echo "Started build on Metorial Forge (runner: AWS/1) ..."',
                'echo "Setting up build environment ..."',

                'apt-get update && apt-get install -y zip unzip curl',

                'mkdir -p ./forge',
                'cd ./forge',
                'mkdir -p ./output',

                logSystem({ type: 'download-artifacts.start' }),
                `echo "Downloading initial files ..."`,

                ...(
                  await Promise.all(
                    artifacts.map(async artifact => {
                      let res = await storage.getPublicURL(
                        artifact.bucket,
                        artifact.storageKey,
                        60 * 60 * 6
                      );

                      return [
                        logSystem({
                          type: 'download-artifact.start',
                          artifactId: artifact.id
                        }),
                        `curl -sL ${shellEscape(res.url)} -o /tmp/artifact_${artifact.oid}.zip`,
                        `unzip -o /tmp/artifact_${artifact.oid}.zip -d ./`,
                        `rm /tmp/artifact_${artifact.oid}.zip`,
                        logSystem({ type: 'download-artifact.end', artifactId: artifact.id })
                      ];
                    })
                  )
                ).flat(),

                logSystem({ type: 'download-artifacts.end' }),

                'echo "Build environment setup complete."',
                logSystem({ type: 'step.end', stepId: setupStep.id }),

                ...initSteps.flatMap(step => [
                  logSystem({ type: 'step.start', stepId: step.id }),
                  ...(step.step?.initScript ?? ['echo "No action"']),
                  logSystem({ type: 'step.end', stepId: step.id })
                ]),

                ...(
                  await Promise.all(
                    actionSteps.flatMap(async step => {
                      let inner: string[] = [];

                      if (step.step?.type == 'script') {
                        inner = step.step?.actionScript ?? ['echo "No action"'];
                      } else if (step.step?.type == 'download_artifact') {
                        let artifact = step.step.artifactToDownload;
                        if (!artifact) throw new Error('WTF - Artifact to download not found');

                        let res = await storage.getPublicURL(
                          artifact.bucket,
                          artifact.storageKey,
                          60 * 60 * 6
                        );

                        inner = [
                          `echo "Downloading artifact ${artifact.name} ..."`,
                          `curl -sL ${shellEscape(res.url)} -o /tmp/artifact_${artifact.oid}`,
                          `mv /tmp/artifact_${artifact.oid} ${shellEscape(step.step.artifactToDownloadPath!)}`,
                          `echo "Download complete."`
                        ];
                      } else if (step.step?.type == 'upload_artifact') {
                        let uploadInfo = await ctx.getArtifactUploadInfo();

                        artifactData[step.id] = {
                          bucket: uploadInfo.bucket,
                          storageKey: uploadInfo.storageKey
                        };

                        inner = [
                          `echo "Uploading artifact ${step.step.artifactToUploadName!} from ${step.step.artifactToUploadPath!} ..."`,
                          `curl -X PUT ${shellEscape(uploadInfo.uploadUrl)} -H "Content-Type: application/octet-stream" --data-binary @${shellEscape(step.step.artifactToUploadPath!)} `,
                          `echo "Upload complete."`,
                          logSystem({
                            type: 'upload-artifact.register',
                            stepId: step.id
                          })
                        ];
                      }

                      return [
                        logSystem({ type: 'step.start', stepId: step.id }),
                        ...inner,
                        logSystem({ type: 'step.end', stepId: step.id })
                      ];
                    })
                  )
                ).flat(),

                ...cleanupSteps.flatMap(step => [
                  logSystem({ type: 'step.start', stepId: step.id }),
                  ...(step.step?.cleanupScript ?? ['echo "No action"']),
                  logSystem({ type: 'step.end', stepId: step.id })
                ]),

                logSystem({ type: 'step.start', stepId: teardownStep.id }),
                'echo "Tearing down build environment ..."',
                'echo "Build complete ... powered by Metorial Forge (AWS/1)."',
                logSystem({ type: 'step.end', stepId: teardownStep.id }),

                logSystem({ type: 'build.end' })
              ]
            }
          }
        })
      })
    );

    await waitForBuildQueue.add({
      runId: ctx.run.id,
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
      await startAwsCodeBuildQueue.add(data, { delay: 30_000 });
      return;
    }

    throw err;
  }
});

let waitForBuildQueue = createQueue<{
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

let waitForBuildQueueProcessor = waitForBuildQueue.process(async data => {
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
    await buildEndedQueue.add(data);
  } else if (inProgress) {
    await startedBuildQueue.add({
      ...data,
      cloudwatch: {
        groupName: build.logs!.groupName!,
        streamName: build.logs!.streamName!
      }
    });
  } else {
    await waitForBuildQueue.add(
      {
        ...data,
        attemptNo: data.attemptNo + 1
      },
      { delay: data.attemptNo < 10 ? 2500 : 5000 }
    );
  }
});

let startedBuildQueue = createQueue<{
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

let startedBuildQueueProcessor = startedBuildQueue.process(async data => {
  if (!codebuild) throw new Error('CodeBuild client not initialized');

  let buildInfo = await codebuild.send(
    new BatchGetBuildsCommand({
      ids: [data.buildId]
    })
  );
  let build = buildInfo.builds?.[0];
  if (!build) return;

  let ctx = await BuildContext.of(data.runId);

  await monitorBuildOutputQueue.add({
    ...data,
    runOid: ctx.run.oid
  });
});

let monitorBuildOutputQueue = createQueue<{
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

let monitorBuildOutputQueueProcessor = monitorBuildOutputQueue.process(async data => {
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

    let systemLog = parseSystemLog(message);

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

  // Build ended as we expected or we've waited long enough after it ended
  if (data.buildEnded || finalAfterCheckNo) {
    await buildEndedQueue.add({
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
    await monitorBuildOutputQueue.add(
      {
        ...data,
        nextToken: logResp.nextForwardToken,
        afterCheckNo
      },
      { delay: hasManyEvents ? 500 : 2500 }
    );
  } else {
    // If we don't have a new token, we can end the build
    await buildEndedQueue.add(
      { runId: data.runId, buildId: data.buildId, artifactData: data.artifactData },
      { delay: 5000 }
    );
  }
});

let buildEndedQueue = createQueue<{
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

let buildEndedQueueProcessor = buildEndedQueue.process(async data => {
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
    await buildEndedQueue.add(data, { delay: 3000 });
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

export let awsCodeBuildProcessors = combineQueueProcessors([
  startBuildQueueProcessor,
  waitForBuildQueueProcessor,
  startedBuildQueueProcessor,
  monitorBuildOutputQueueProcessor,
  buildEndedQueueProcessor
]);

if (
  process.env.NODE_ENV == 'production' &&
  process.env.DEFAULT_PROVIDER === 'aws.code-build'
) {
  await checkCodeBuildAccess();
}
