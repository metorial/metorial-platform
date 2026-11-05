import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { forge } from './client';
import { createTenant, createVersion, createWorkflow, createWorkflowWithVersion } from './fixtures';

describe('forge workflow version', () => {
  it('creates a version with steps and makes it current', async () => {
    let tenant = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    let version = await forge.workflowVersion.create({
      tenantId: tenant.id,
      workflowId: workflow.id,
      name: 'Version 1.0',
      steps: [
        {
          name: 'Build Step',
          type: 'script',
          initScript: ['echo "initializing"'],
          actionScript: ['npm install', 'npm run build'],
          cleanupScript: ['echo "cleaning up"']
        },
        {
          name: 'Upload Output',
          type: 'upload_artifact',
          artifactSourcePath: './dist',
          artifactName: 'build-output'
        }
      ]
    });

    expect(version).toMatchObject({ name: 'Version 1.0', workflowId: workflow.id });
    expect(version.steps).toHaveLength(2);
    expect(version.steps[0]).toMatchObject({
      name: 'Build Step',
      type: 'script',
      initScript: ['echo "initializing"'],
      actionScript: ['npm install', 'npm run build'],
      cleanupScript: ['echo "cleaning up"']
    });
    expect(version.steps[1]).toMatchObject({
      type: 'upload_artifact',
      artifactSourcePath: './dist',
      artifactName: 'build-output'
    });

    let row = await db.workflow.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { currentVersion: true }
    });
    expect(row.currentVersion?.id).toBe(version.id);
  });

  it('keeps all versions and switches the current one', async () => {
    let { tenant, workflow, version: first } = await createWorkflowWithVersion();
    let second = await createVersion({ tenantId: tenant.id, workflowId: workflow.id });

    let list = await forge.workflowVersion.list({
      tenantId: tenant.id,
      workflowId: workflow.id,
      limit: 10
    });
    expect(list.items.map(i => i.id)).toEqual(expect.arrayContaining([first.id, second.id]));

    let row = await db.workflow.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { currentVersion: true }
    });
    expect(row.currentVersion?.id).toBe(second.id);
  });

  it('gets a version by id', async () => {
    let { tenant, workflow, version } = await createWorkflowWithVersion();

    let fetched = await forge.workflowVersion.get({
      tenantId: tenant.id,
      workflowId: workflow.id,
      workflowVersionId: version.id
    });
    expect(fetched).toMatchObject({ id: version.id, name: version.name });
  });

  it('does not expose a version through another workflow', async () => {
    let { tenant, version } = await createWorkflowWithVersion();
    let otherWorkflow = await createWorkflow(tenant.id);

    await expect(
      forge.workflowVersion.get({
        tenantId: tenant.id,
        workflowId: otherWorkflow.id,
        workflowVersionId: version.id
      })
    ).rejects.toThrow();
  });

  it('rejects a version with an invalid step', async () => {
    let tenant = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    await expect(
      forge.workflowVersion.create({
        tenantId: tenant.id,
        workflowId: workflow.id,
        name: 'Broken',
        steps: [{ name: 'Bad', type: 'script' } as any]
      })
    ).rejects.toThrow();
  });
});
