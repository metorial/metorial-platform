import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowRunStatus, WorkflowRunStepType } from '../../../prisma/generated/client';
import { forgeClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

vi.mock('../../providers', () => ({
  startBuildQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));

vi.mock('../../storage', () => ({
  storage: {
    putObject: vi.fn().mockResolvedValue({ storageKey: 'test-key' }),
    getObject: vi.fn().mockResolvedValue({ data: Buffer.from('') }),
    getPublicURL: vi.fn().mockResolvedValue({ url: 'http://example.com/artifact' }),
    upsertBucket: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('workflowRun:create E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new workflow run with env and files', async () => {
    const version = await f.workflowVersion.complete();

    const result = await forgeClient.workflowRun.create({
      tenantId: version.workflow.tenant.id,
      workflowId: version.workflow.id,
      env: { NODE_ENV: 'production' },
      files: [{ filename: 'index.js', content: 'console.log("hello")' }]
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      status: WorkflowRunStatus.pending,
      workflowId: version.workflow.id,
      version: version.id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });

    expect(result.steps).toBeInstanceOf(Array);
    expect(result.steps.length).toBeGreaterThan(0);

    // Should have setup and teardown steps
    const stepTypes = result.steps.map(s => s.type);
    expect(stepTypes).toContain(WorkflowRunStepType.setup);
    expect(stepTypes).toContain(WorkflowRunStepType.teardown);
  });

  it('rejects creating run for workflow without active version', async () => {
    const workflow = await f.workflow.withTenant();

    await expect(
      forgeClient.workflowRun.create({
        tenantId: workflow.tenant.id,
        workflowId: workflow.id,
        env: { NODE_ENV: 'production' },
        files: []
      })
    ).rejects.toThrow();
  });
});

describe('workflowRun:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns workflow runs for a workflow', async () => {
    const run1 = await f.workflowRun.pending();
    const workflow = run1.workflow;

    // Create additional runs
    const additionalRuns = await Promise.all(
      times(2, () =>
        f.workflowRun.default({
          workflowOid: workflow.oid,
          versionOid: run1.version.oid,
          providerOid: workflow.provider.oid
        })
      )
    );
    const runs = [run1, ...additionalRuns];

    const runIds = runs.map(r => r.id);
    const otherRun = await f.workflowRun.pending();

    const result = await forgeClient.workflowRun.list({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id,
      limit: 10
    });

    expect(result.items).toHaveLength(3);
    result.items.forEach(item => {
      expect(runIds).toContain(item.id);
    });
    expect(result.items.map(item => item.id)).not.toContain(otherRun.id);
  });
});

describe('workflowRun:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a workflow run by ID', async () => {
    const run = await f.workflowRun.succeeded();

    const result = await forgeClient.workflowRun.get({
      tenantId: run.workflow.tenant.id,
      workflowId: run.workflow.id,
      workflowRunId: run.id
    });

    expect(result).toMatchObject({
      id: run.id,
      status: WorkflowRunStatus.succeeded,
      workflowId: run.workflow.id,
      version: run.version.id
    });
    expect(result.steps).toBeInstanceOf(Array);
  });
});

describe('workflowRun:getOutput E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns output for all steps', async () => {
    const run = await f.workflowRun.succeeded();

    const result = await forgeClient.workflowRun.getOutput({
      tenantId: run.workflow.tenant.id,
      workflowId: run.workflow.id,
      workflowRunId: run.id
    });

    expect(result).toBeInstanceOf(Array);
    result.forEach(output => {
      expect(output).toMatchObject({
        step: expect.objectContaining({}),
        logs: expect.any(Array),
        source: expect.stringMatching(/^(storage|temp)$/)
      });
    });
  });
});

describe('workflowRun:getOutputForStep E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns output for a specific step', async () => {
    const run = await f.workflowRun.succeeded();
    const [step] = run.steps;
    if (!step) {
      throw new Error('Expected workflow run to have at least one step');
    }

    const result = await forgeClient.workflowRun.getOutputForStep({
      tenantId: run.workflow.tenant.id,
      workflowId: run.workflow.id,
      workflowRunId: run.id,
      workflowRunStepId: step.id
    });

    expect(result).toMatchObject({
      logs: expect.any(Array),
      source: expect.stringMatching(/^(storage|temp)$/)
    });
  });
});
