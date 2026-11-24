import { logTail, reportFailure } from '@metorial/error-reporting/failure';
import { db } from '../db';

// A workflow's own commands exiting non-zero is the build script's problem, not the system's.
let scriptFailureCode = 'build_failed';
let warningCodes = new Set(['build_runtime_timeout']);

let parseOutputLine = (line: string) => {
  try {
    let parsed = JSON.parse(line);
    return Array.isArray(parsed) && typeof parsed[1] === 'string' ? parsed[1] : line;
  } catch {
    return line;
  }
};

let durationMs = (from: Date | null | undefined, to: Date | null | undefined) =>
  from && to ? to.getTime() - from.getTime() : undefined;

export let reportBuildFailure = async (d: {
  runId: string;
  failure: { code: string; message: string };
}) => {
  if (d.failure.code === scriptFailureCode) return;

  let run = await db.workflowRun.findFirst({
    where: { id: d.runId },
    include: {
      workflow: { include: { tenant: true } },
      version: true,
      provider: true,
      steps: { orderBy: { index: 'asc' } }
    }
  });
  if (!run) return;

  let failedStep =
    run.steps.find(step => step.status === 'failed') ??
    run.steps.findLast(step => step.startedAt);
  let output = failedStep
    ? await db.workflowRunOutputTemp.findMany({
        where: { stepOid: failedStep.oid },
        orderBy: { createdAt: 'asc' }
      })
    : [];
  let log = output.flatMap(o => o.output.split('\n').filter(Boolean).map(parseOutputLine));

  reportFailure({
    type: 'BuildFailed',
    level: warningCodes.has(d.failure.code) ? 'warning' : 'error',
    fingerprint: ['build-failed', d.failure.code, run.provider.identifier],
    message: `Build failed: ${d.failure.message} (run ${run.id})`,
    tags: {
      error_code: d.failure.code,
      provider: run.provider.identifier,
      step: failedStep?.name
    },
    details: {
      build_run_id: run.id,
      workflow: run.workflow.identifier,
      workflow_name: run.workflow.name,
      workflow_version: run.version.identifier,
      tenant: run.workflow.tenant.identifier,
      provider: run.provider.identifier,
      failure_code: d.failure.code,
      failure_message: d.failure.message,
      failed_step: failedStep?.name,
      failed_step_type: failedStep?.type,
      failed_step_index: failedStep?.index,
      steps_total: run.steps.length,
      steps_succeeded: run.steps.filter(step => step.status === 'succeeded').length,
      queue_wait_ms: durationMs(
        run.kubernetesQueuedAt,
        run.kubernetesAdmittedAt ?? run.endedAt
      ),
      time_to_start_ms: durationMs(run.createdAt, run.startedAt),
      duration_ms: durationMs(run.startedAt ?? run.createdAt, run.endedAt)
    },
    log: logTail(log)
  });
};
