let MAX_REASON_LENGTH = 2000;

export let GENERIC_BUILD_FAILURE_MESSAGE = 'The build workflow run failed.';

export interface BuildStepOutput {
  step: { status: string };
  logs: unknown;
}

let lastLogMessage = (logs: unknown) => {
  if (!Array.isArray(logs)) return undefined;

  for (let i = logs.length - 1; i >= 0; i--) {
    let message = logs[i]?.message;
    if (typeof message == 'string' && message.trim()) return message.trim();
  }

  return undefined;
};

export let getBuildFailureReason = (steps: BuildStepOutput[]) => {
  let failedSteps = steps.filter(s => s.step.status == 'failed');
  let candidates = [...failedSteps.reverse(), ...[...steps].reverse()];

  for (let step of candidates) {
    let message = lastLogMessage(step.logs);
    if (message) return message.slice(0, MAX_REASON_LENGTH);
  }

  return GENERIC_BUILD_FAILURE_MESSAGE;
};
