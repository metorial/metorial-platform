import { describe, expect, it, vi } from 'vitest';
import { applyBuildLog, type BuildLogState } from './buildLog';
import { echoSystemMarker, type SystemMarker } from './buildScript';

let marker = (m: SystemMarker) => echoSystemMarker(m).slice('echo '.length).slice(1, -1);

let createCtx = () => {
  let stepOids: Record<string, bigint> = { setup: 1n, build: 2n, upload: 3n };

  return {
    startRun: vi.fn(async () => {}),
    startStep: vi.fn(async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! }) as any),
    completeStep: vi.fn(
      async (d: { stepId: string }) => ({ oid: stepOids[d.stepId]! }) as any
    ),
    getStepById: vi.fn(async (stepId: string) => ({ id: stepId, step: null }) as any),
    completeArtifactUpload: vi.fn(async () => {}),
    storeTempOutput: vi.fn(async (_d: { stepOid: bigint; message: string }) => {})
  };
};

describe('applyBuildLog', () => {
  it('turns markers into run and step transitions and collects step output', async () => {
    let ctx = createCtx();
    let state: BuildLogState = {};

    await applyBuildLog({
      ctx,
      state,
      artifactData: { upload: { bucket: 'artifacts', storageKey: 'run/upload' } },
      lines: [
        { timestamp: 900, message: 'before the build' },
        { timestamp: 1000, message: marker({ type: 'build.start' }) },
        { timestamp: 1001, message: marker({ type: 'step.start', stepId: 'setup' }) },
        { timestamp: 1002, message: '  Setting up  ' },
        { timestamp: 1003, message: '   ' },
        { timestamp: 1004, message: marker({ type: 'step.end', stepId: 'setup' }) },
        { timestamp: 1005, message: 'between steps' },
        { timestamp: 1006, message: marker({ type: 'step.start', stepId: 'upload' }) },
        { timestamp: 1007, message: 'uploading' },
        {
          timestamp: 1008,
          message: marker({ type: 'upload-artifact.register', stepId: 'upload' })
        },
        { timestamp: 1009, message: marker({ type: 'step.end', stepId: 'upload' }) },
        { timestamp: 1010, message: marker({ type: 'step.start', stepId: 'build' }) },
        { timestamp: 1011, message: 'compiling' }
      ]
    });

    expect(ctx.startRun).toHaveBeenCalledWith({ startedAt: new Date(1000) });
    expect(ctx.startStep.mock.calls.map(c => c[0])).toEqual([
      { stepId: 'setup', startedAt: new Date(1001) },
      { stepId: 'upload', startedAt: new Date(1006) },
      { stepId: 'build', startedAt: new Date(1010) }
    ]);
    expect(ctx.completeStep).toHaveBeenCalledWith({
      stepId: 'setup',
      status: 'succeeded',
      endedAt: new Date(1004)
    });
    expect(ctx.completeArtifactUpload).toHaveBeenCalledWith({
      step: { id: 'upload', step: null },
      artifactData: { bucket: 'artifacts', storageKey: 'run/upload' }
    });
    expect(ctx.storeTempOutput.mock.calls.map(c => c[0])).toEqual([
      { stepOid: 1n, message: '[1002,"Setting up"]\n' },
      { stepOid: 3n, message: '[1007,"uploading"]\n' },
      { stepOid: 2n, message: '[1011,"compiling"]\n' }
    ]);
    expect(state).toEqual({ buildStarted: true, currentStepOid: 2n });
  });

  it('continues from the state of the previous page', async () => {
    let ctx = createCtx();
    let state: BuildLogState = { buildStarted: true, currentStepOid: 2n };

    await applyBuildLog({
      ctx,
      state,
      artifactData: {},
      lines: [
        { timestamp: 2000, message: 'still compiling' },
        { timestamp: 2001, message: marker({ type: 'step.end', stepId: 'build' }) },
        { timestamp: 2002, message: marker({ type: 'build.end' }) },
        { timestamp: 2003, message: 'after the build' }
      ]
    });

    expect(ctx.storeTempOutput).toHaveBeenCalledTimes(1);
    expect(ctx.storeTempOutput).toHaveBeenCalledWith({
      stepOid: 2n,
      message: '[2000,"still compiling"]\n'
    });
    expect(state).toEqual({ buildStarted: true, buildEnded: true, currentStepOid: undefined });
  });

  it('skips upload registrations without a planned artifact', async () => {
    let ctx = createCtx();

    await applyBuildLog({
      ctx,
      state: {},
      artifactData: {},
      lines: [{ message: marker({ type: 'upload-artifact.register', stepId: 'upload' }) }]
    });

    expect(ctx.completeArtifactUpload).not.toHaveBeenCalled();
  });
});
