import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { BuildContext } from './buildContext';

export type BuildRunStep = Awaited<ReturnType<BuildContext['listSteps']>>[number];

export abstract class ForgeBuildAdapter {
  protected readonly runtime = 'metorial-forge@1.0.0';

  abstract readonly startBuildQueue: ReturnType<typeof createQueue<{ runId: string }>>;
  abstract readonly buildProviderProcessors: ReturnType<typeof combineQueueProcessors>;

  abstract startBuild(runId: string): Promise<void>;

  protected createStartBuildProcessor() {
    return this.startBuildQueue.process(async data => {
      await this.startBuild(data.runId);
    });
  }

  protected combineProcessors(processors: any[]) {
    return combineQueueProcessors(processors);
  }

  protected async resolveBuildRun(runId: string) {
    let ctx = await BuildContext.of(runId);
    let version = await ctx.getVersion();
    let steps = await ctx.listSteps();
    let artifacts = await ctx.listArtifacts();
    let envVars = await ctx.DANGEROUSLY_getDecryptedEnvVars();

    let setupStep = steps.find(s => s.type === 'setup');
    let teardownStep = steps.find(s => s.type === 'teardown');

    if (!setupStep || !teardownStep) {
      throw new Error('Forge run is missing setup or teardown steps');
    }

    return {
      ctx,
      version,
      steps,
      artifacts,
      envVars,
      runtimeEnv: {
        ...envVars,
        WORKFLOW_RUN_ID: ctx.run.id,
        WORKFLOW_VERSION_ID: version.id,
        RUNTIME: this.runtime
      },
      setupStep,
      teardownStep,
      initSteps: steps.filter(s => s.type === 'init'),
      actionSteps: steps.filter(s => s.type === 'action'),
      cleanupSteps: steps.filter(s => s.type === 'cleanup')
    };
  }

  protected createStepLogger(ctx: BuildContext, stepOid: bigint) {
    let buffer = '';

    let flush = async () => {
      if (!buffer) return;
      let message = buffer;
      buffer = '';

      await ctx.storeTempOutput({
        stepOid,
        message
      });
    };

    return {
      flush,
      writeLine: async (message: string, timestamp = Date.now()) => {
        buffer += JSON.stringify([timestamp, message]) + '\n';

        if (buffer.length >= 16_384) {
          await flush();
        }
      }
    };
  }

  protected async withManagedStep(
    ctx: BuildContext,
    step: BuildRunStep,
    fn: (logger: ReturnType<ForgeBuildAdapter['createStepLogger']>) => Promise<void>
  ) {
    let runningStep = await ctx.startStep({
      stepId: step.id,
      startedAt: new Date()
    });
    let logger = this.createStepLogger(ctx, runningStep.oid);

    try {
      await fn(logger);
      await logger.flush();

      await ctx.completeStep({
        stepId: step.id,
        status: 'succeeded',
        endedAt: new Date()
      });
    } catch (err) {
      await logger.writeLine(`Build failed: ${this.toErrorMessage(err)}`);
      await logger.flush();

      await ctx.completeStep({
        stepId: step.id,
        status: 'failed',
        endedAt: new Date()
      });

      throw err;
    }
  }

  protected async failBuild(ctx: BuildContext, err: unknown, label = 'Forge build failed') {
    console.error(label, err);

    await ctx.completeBuild({
      status: 'failed'
    });
  }

  protected toErrorMessage(err: unknown) {
    return String(err instanceof Error ? err.message : err);
  }
}
