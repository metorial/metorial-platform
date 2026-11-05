import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { forge } from './client';
import {
  createFinishedRun,
  createTenant,
  createWorkflow,
  createWorkflowWithVersion
} from './fixtures';

describe('forge workflow run', () => {
  it('creates a run with setup and teardown steps and an input artifact', async () => {
    let { tenant, workflow, version } = await createWorkflowWithVersion();

    let run = await forge.workflowRun.create({
      tenantId: tenant.id,
      workflowId: workflow.id,
      env: { NODE_ENV: 'production' },
      files: [{ filename: 'index.js', content: 'console.log("hello")' }]
    });

    expect(run).toMatchObject({ workflowId: workflow.id, version: version.id });
    expect(['pending', 'running', 'failed', 'succeeded']).toContain(run.status);

    let stepTypes = run.steps.map(s => s.type);
    expect(stepTypes).toContain('setup');
    expect(stepTypes).toContain('action');
    expect(stepTypes).toContain('teardown');

    let artifacts = await db.workflowArtifact.findMany({
      where: { run: { id: run.id } }
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ type: 'input', name: 'input.zip' });
  });

  it('does not store environment variables in plain text', async () => {
    let { tenant, workflow } = await createWorkflowWithVersion();

    let run = await forge.workflowRun.create({
      tenantId: tenant.id,
      workflowId: workflow.id,
      env: { SECRET_VALUE: 'super-secret-value' },
      files: []
    });

    let row = await db.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.encryptedEnvironmentVariables).not.toContain('super-secret-value');
    expect(JSON.stringify(run)).not.toContain('super-secret-value');
  });

  it('rejects creating a run for a workflow without a version', async () => {
    let tenant = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    await expect(
      forge.workflowRun.create({
        tenantId: tenant.id,
        workflowId: workflow.id,
        env: {},
        files: []
      })
    ).rejects.toThrow();

    let runs = await db.workflowRun.count({ where: { workflow: { id: workflow.id } } });
    expect(runs).toBe(0);
  });

  it('lists only the runs of the workflow', async () => {
    let a = await createWorkflowWithVersion();
    let b = await createWorkflowWithVersion();

    let runA = await createFinishedRun({ workflowId: a.workflow.id });
    let runB = await createFinishedRun({ workflowId: b.workflow.id });

    let list = await forge.workflowRun.list({
      tenantId: a.tenant.id,
      workflowId: a.workflow.id,
      limit: 10
    });

    let ids = list.items.map(i => i.id);
    expect(ids).toContain(runA.run.id);
    expect(ids).not.toContain(runB.run.id);
  });

  it('gets a run by id and hides it from other workflows', async () => {
    let a = await createWorkflowWithVersion();
    let b = await createWorkflowWithVersion();
    let { run } = await createFinishedRun({ workflowId: a.workflow.id });

    let fetched = await forge.workflowRun.get({
      tenantId: a.tenant.id,
      workflowId: a.workflow.id,
      workflowRunId: run.id
    });
    expect(fetched).toMatchObject({
      id: run.id,
      status: 'succeeded',
      workflowId: a.workflow.id,
      version: a.version.id
    });
    expect(fetched.steps).toHaveLength(1);

    await expect(
      forge.workflowRun.get({
        tenantId: b.tenant.id,
        workflowId: b.workflow.id,
        workflowRunId: run.id
      })
    ).rejects.toThrow();
  });

  it('returns step output from temporary storage', async () => {
    let { tenant, workflow } = await createWorkflowWithVersion();
    let { run, step } = await createFinishedRun({
      workflowId: workflow.id,
      output: [[1000, 'first line'], [2000, 'second line']]
    });

    let output = await forge.workflowRun.getOutput({
      tenantId: tenant.id,
      workflowId: workflow.id,
      workflowRunId: run.id
    });
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ source: 'temp' });
    expect(output[0]!.logs.map(l => l.message)).toEqual(['first line', 'second line']);

    let forStep = await forge.workflowRun.getOutputForStep({
      tenantId: tenant.id,
      workflowId: workflow.id,
      workflowRunId: run.id,
      workflowRunStepId: step.id
    });
    expect(forStep.source).toBe('temp');
    expect(forStep.logs.map(l => l.message)).toEqual(['first line', 'second line']);
  });

  it('rejects output for a step of another run', async () => {
    let { tenant, workflow } = await createWorkflowWithVersion();
    let first = await createFinishedRun({ workflowId: workflow.id });
    let second = await createFinishedRun({ workflowId: workflow.id });

    await expect(
      forge.workflowRun.getOutputForStep({
        tenantId: tenant.id,
        workflowId: workflow.id,
        workflowRunId: first.run.id,
        workflowRunStepId: second.step.id
      })
    ).rejects.toThrow();
  });
});
