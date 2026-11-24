import type { BuildContext } from './buildContext';
import { parseSystemMarker, type ArtifactTarget } from './buildScript';

export type BuildLogState = {
  buildStarted?: boolean;
  buildEnded?: boolean;
  currentStepOid?: bigint;
};

export type BuildLogLine = { timestamp?: number; message: string };

type BuildLogContext = Pick<
  BuildContext,
  | 'startRun'
  | 'startStep'
  | 'completeStep'
  | 'getStepById'
  | 'completeArtifactUpload'
  | 'storeTempOutput'
>;

export let applyBuildLog = async (d: {
  ctx: BuildLogContext;
  state: BuildLogState;
  artifactData: Record<string, ArtifactTarget>;
  startupStepOid?: bigint;
  lines: BuildLogLine[];
}) => {
  let { ctx, state } = d;
  let collectedMessages = new Map<bigint, string>();

  for (let line of d.lines) {
    let message = line.message.trim();
    let at = line.timestamp ? new Date(line.timestamp) : new Date();
    let marker = parseSystemMarker(message);

    if (marker) {
      if (marker.type === 'build.start') {
        await ctx.startRun({ startedAt: at });
        state.buildStarted = true;
      } else if (marker.type === 'build.end') {
        state.buildEnded = true;
      } else if (marker.type === 'step.start') {
        let step = await ctx.startStep({ stepId: marker.stepId, startedAt: at });
        state.currentStepOid = step.oid;
      } else if (marker.type === 'step.end') {
        let step = await ctx.completeStep({
          stepId: marker.stepId,
          status: 'succeeded',
          endedAt: at
        });
        if (state.currentStepOid === step.oid) state.currentStepOid = undefined;
      } else if (marker.type === 'upload-artifact.register') {
        let step = await ctx.getStepById(marker.stepId);
        let artifactData = step ? d.artifactData[step.id] : null;

        if (artifactData && step) {
          await ctx.completeArtifactUpload({ step, artifactData });
        }
      }
      continue;
    }

    let stepOid = !state.buildStarted ? d.startupStepOid : state.currentStepOid;
    if (!message || !stepOid || state.buildEnded) continue;

    let output = collectedMessages.get(stepOid) || '';
    output += JSON.stringify([line.timestamp || 0, message]) + '\n';
    collectedMessages.set(stepOid, output);
  }

  for (let [stepOid, message] of collectedMessages.entries()) {
    await ctx.storeTempOutput({ stepOid, message });
  }
};
