import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowStatus } from '../../../prisma/generated/client';
import { forgeClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

vi.mock('../../providers', () => ({
  startBuildQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));


vi.mock('../../queues/deleteWorkflow', () => ({
  deleteWorkflowQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));

describe('workflow:upsert E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new workflow', async () => {
    const tenant = await f.tenant.default();

    const result = await forgeClient.workflow.upsert({
      tenantId: tenant.id,
      identifier: 'my-workflow',
      name: 'My Workflow'
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: 'my-workflow',
      name: 'My Workflow',
      status: WorkflowStatus.active,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('updates existing workflow with same identifier', async () => {
    const tenant = await f.tenant.default();

    await forgeClient.workflow.upsert({
      tenantId: tenant.id,
      identifier: 'existing-workflow',
      name: 'Original Name'
    });

    const result = await forgeClient.workflow.upsert({
      tenantId: tenant.id,
      identifier: 'existing-workflow',
      name: 'Updated Name'
    });

    expect(result).toMatchObject({
      identifier: 'existing-workflow',
      name: 'Updated Name'
    });
  });
});

describe('workflow:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns workflows for a tenant', async () => {
    const workflow = await f.workflow.withTenant();
    const tenant = workflow.tenant;
    const provider = workflow.provider;

    // Create additional workflows
    const additionalWorkflows = await Promise.all(
      times(2, (i: number) =>
        f.workflow.default({
          tenantOid: tenant.oid,
          providerOid: provider.oid,
          overrides: { identifier: `workflow-${i + 1}` }
        })
      )
    );
    const workflows = [workflow, ...additionalWorkflows];

    // Create workflow for different tenant (shouldn't appear)
    const otherWorkflow = await f.workflow.withTenant({
      workflowOverrides: { identifier: 'other-workflow' }
    });

    const workflowIds = workflows.map(w => w.id);

    const result = await forgeClient.workflow.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(3);
    result.items.forEach(item => {
      expect(workflowIds).toContain(item.id);
    });
    expect(result.items.map(i => i.id)).not.toContain(otherWorkflow.id);
  });
});

describe('workflow:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a workflow by ID', async () => {
    const workflow = await f.workflow.withTenant();

    const result = await forgeClient.workflow.get({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id
    });

    expect(result).toMatchObject({
      id: workflow.id,
      identifier: workflow.identifier,
      name: workflow.name,
      status: WorkflowStatus.active
    });
  });

  it('cannot access workflow from different tenant', async () => {
    const workflow = await f.workflow.withTenant();
    const otherTenant = await f.tenant.default({ identifier: 'other-tenant' });

    await expect(
      forgeClient.workflow.get({
        tenantId: otherTenant.id,
        workflowId: workflow.id
      })
    ).rejects.toThrow();
  });
});

describe('workflow:update E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('updates workflow name', async () => {
    const workflow = await f.workflow.withTenant();

    const result = await forgeClient.workflow.update({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id,
      name: 'Updated Workflow Name'
    });

    expect(result).toMatchObject({
      id: workflow.id,
      name: 'Updated Workflow Name'
    });
  });

  it('cannot update workflow from different tenant', async () => {
    const workflow = await f.workflow.withTenant();
    const otherTenant = await f.tenant.default({ identifier: 'other-tenant' });

    await expect(
      forgeClient.workflow.update({
        tenantId: otherTenant.id,
        workflowId: workflow.id,
        name: 'Hacked Name'
      })
    ).rejects.toThrow();
  });
});

describe('workflow:delete E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('deletes a workflow', async () => {
    const workflow = await f.workflow.withTenant();

    const result = await forgeClient.workflow.delete({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id
    });

    expect(result).toMatchObject({
      id: workflow.id,
      status: WorkflowStatus.active // Status change happens async via queue
    });
  });

  it('cannot delete workflow from different tenant', async () => {
    const workflow = await f.workflow.withTenant();
    const otherTenant = await f.tenant.default({ identifier: 'other-tenant' });

    await expect(
      forgeClient.workflow.delete({
        tenantId: otherTenant.id,
        workflowId: workflow.id
      })
    ).rejects.toThrow();
  });
});
