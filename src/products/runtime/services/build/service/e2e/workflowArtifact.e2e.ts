import { generatePlainId } from '@lowerdeck/id';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { env } from '../src/env';
import { ID, snowflake } from '../src/id';
import { forge } from './client';
import { createFinishedRun, createWorkflowWithVersion } from './fixtures';

let createArtifact = async (input: { runId: string; name: string }) => {
  let run = await db.workflowRun.findUniqueOrThrow({ where: { id: input.runId } });

  return db.workflowArtifact.create({
    data: {
      oid: snowflake.nextId(),
      id: await ID.generateId('workflowArtifact'),
      name: input.name,
      type: 'output',
      storageKey: `${run.id}/${generatePlainId(10)}`,
      bucket: env.storage.ARTIFACT_BUCKET_NAME,
      workflowOid: run.workflowOid,
      runOid: run.oid
    }
  });
};

describe('forge workflow artifact', () => {
  it('lists only the artifacts of the workflow', async () => {
    let a = await createWorkflowWithVersion();
    let b = await createWorkflowWithVersion();
    let runA = await createFinishedRun({ workflowId: a.workflow.id });
    let runB = await createFinishedRun({ workflowId: b.workflow.id });

    let first = await createArtifact({ runId: runA.run.id, name: 'a-1.zip' });
    let second = await createArtifact({ runId: runA.run.id, name: 'a-2.zip' });
    let foreign = await createArtifact({ runId: runB.run.id, name: 'b-1.zip' });

    let list = await forge.workflowArtifact.list({
      tenantId: a.tenant.id,
      workflowId: a.workflow.id,
      limit: 10
    });

    let ids = list.items.map(i => i.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).not.toContain(foreign.id);
  });

  it('gets an artifact with a download url', async () => {
    let { tenant, workflow } = await createWorkflowWithVersion();
    let { run } = await createFinishedRun({ workflowId: workflow.id });
    let artifact = await createArtifact({ runId: run.id, name: 'output.zip' });

    let fetched = await forge.workflowArtifact.get({
      tenantId: tenant.id,
      workflowId: workflow.id,
      workflowArtifactId: artifact.id
    });

    expect(fetched).toMatchObject({
      id: artifact.id,
      name: 'output.zip',
      type: 'output',
      runId: run.id,
      workflowId: workflow.id
    });
    expect(fetched.url.url).toEqual(expect.any(String));
  });

  it('exposes the input artifact stored when a run is created', async () => {
    let { tenant, workflow } = await createWorkflowWithVersion();

    let run = await forge.workflowRun.create({
      tenantId: tenant.id,
      workflowId: workflow.id,
      env: {},
      files: [{ filename: 'a.txt', content: 'hello' }]
    });

    let list = await forge.workflowArtifact.list({
      tenantId: tenant.id,
      workflowId: workflow.id,
      limit: 10
    });

    let input = list.items.find(i => i.runId === run.id);
    expect(input).toMatchObject({ type: 'input', name: 'input.zip' });
  });

  it('does not expose an artifact of another workflow', async () => {
    let a = await createWorkflowWithVersion();
    let b = await createWorkflowWithVersion();
    let { run } = await createFinishedRun({ workflowId: a.workflow.id });
    let artifact = await createArtifact({ runId: run.id, name: 'secret.zip' });

    await expect(
      forge.workflowArtifact.get({
        tenantId: b.tenant.id,
        workflowId: b.workflow.id,
        workflowArtifactId: artifact.id
      })
    ).rejects.toThrow();
  });
});
