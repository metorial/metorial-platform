import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  reportFailure: vi.fn(),
  findRun: vi.fn(),
  findOutput: vi.fn()
}));

vi.mock('@metorial/error-reporting/failure', async importOriginal => ({
  ...(await importOriginal<typeof import('@metorial/error-reporting/failure')>()),
  reportFailure: mocks.reportFailure
}));

vi.mock('../db', () => ({
  db: {
    workflowRun: { findFirst: mocks.findRun },
    workflowRunOutputTemp: { findMany: mocks.findOutput }
  }
}));

import { reportBuildFailure } from './reportBuildFailure';

let at = (seconds: number) => new Date(Date.UTC(2026, 10, 24, 12, 0, seconds));

let run = {
  oid: 1n,
  id: 'frun_1',
  createdAt: at(0),
  startedAt: at(4),
  endedAt: at(34),
  kubernetesQueuedAt: at(1),
  kubernetesAdmittedAt: at(3),
  workflow: {
    identifier: 'fncbay_builder_nodejs',
    name: 'Node.js builder',
    tenant: { identifier: 'function-bay' }
  },
  version: { identifier: 'v3' },
  provider: { identifier: 'kubernetes' },
  steps: [
    {
      oid: 10n,
      name: 'Prepare',
      type: 'setup',
      status: 'succeeded',
      index: 0,
      startedAt: at(4)
    },
    {
      oid: 11n,
      name: 'Install',
      type: 'script',
      status: 'failed',
      index: 1,
      startedAt: at(6)
    },
    { oid: 12n, name: 'Upload', type: 'script', status: 'canceled', index: 2, startedAt: null }
  ]
};

describe('reportBuildFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRun.mockResolvedValue(run);
    mocks.findOutput.mockResolvedValue([
      {
        output: `${JSON.stringify([1, 'npm install'])}\n${JSON.stringify([2, 'ENOSPC: no space left on device'])}\n`
      }
    ]);
  });

  it('reports an infrastructure failure with the run, step timing and log tail', async () => {
    await reportBuildFailure({
      runId: 'frun_1',
      failure: { code: 'build_infrastructure_error', message: 'Pod was evicted' }
    });

    expect(mocks.findOutput).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stepOid: 11n } })
    );
    expect(mocks.reportFailure).toHaveBeenCalledWith({
      type: 'BuildFailed',
      level: 'error',
      fingerprint: ['build-failed', 'build_infrastructure_error', 'kubernetes'],
      message: 'Build failed: Pod was evicted (run frun_1)',
      tags: {
        error_code: 'build_infrastructure_error',
        provider: 'kubernetes',
        step: 'Install'
      },
      details: expect.objectContaining({
        build_run_id: 'frun_1',
        workflow: 'fncbay_builder_nodejs',
        workflow_version: 'v3',
        failed_step: 'Install',
        failed_step_type: 'script',
        steps_total: 3,
        steps_succeeded: 1,
        queue_wait_ms: 2000,
        time_to_start_ms: 4000,
        duration_ms: 30000
      }),
      log: ['npm install', 'ENOSPC: no space left on device']
    });
  });

  it('reports runtime timeouts as warnings', async () => {
    await reportBuildFailure({
      runId: 'frun_1',
      failure: { code: 'build_runtime_timeout', message: 'Build ran too long' }
    });

    expect(mocks.reportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning' })
    );
  });

  it('leaves failures of the workflow script itself alone', async () => {
    await reportBuildFailure({
      runId: 'frun_1',
      failure: { code: 'build_failed', message: 'Command failed with exit code 1' }
    });

    expect(mocks.findRun).not.toHaveBeenCalled();
    expect(mocks.reportFailure).not.toHaveBeenCalled();
  });
});
