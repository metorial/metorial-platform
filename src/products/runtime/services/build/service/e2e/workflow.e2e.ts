import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { forge } from './client';
import { createTenant, createWorkflow } from './fixtures';

describe('forge workflow', () => {
  it('upserts a workflow by identifier within a tenant', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('workflow');

    let created = await forge.workflow.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Original'
    });
    expect(created).toMatchObject({ identifier, name: 'Original', status: 'active' });

    let updated = await forge.workflow.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Renamed'
    });
    expect(updated).toMatchObject({ id: created.id, name: 'Renamed' });

    let rows = await db.workflow.findMany({ where: { tenantOid: tenant.oid, identifier } });
    expect(rows).toHaveLength(1);
  });

  it('lists only the workflows of the tenant', async () => {
    let tenant = await createTenant();
    let other = await createTenant();

    let first = await createWorkflow(tenant.id);
    let second = await createWorkflow(tenant.id);
    let foreign = await createWorkflow(other.id);

    let list = await forge.workflow.list({ tenantId: tenant.id, limit: 10 });

    let ids = list.items.map(i => i.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).not.toContain(foreign.id);
  });

  it('pages through workflows', async () => {
    let tenant = await createTenant();
    let created = await Promise.all([
      createWorkflow(tenant.id),
      createWorkflow(tenant.id),
      createWorkflow(tenant.id)
    ]);

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      let result = await forge.workflow.list({ tenantId: tenant.id, limit: 1, after });
      seen.push(...result.items.map(i => i.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect(new Set(seen).size).toBe(3);
    expect([...seen].sort()).toEqual(created.map(c => c.id).sort());
  });

  it('gets and updates a workflow', async () => {
    let tenant = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    let fetched = await forge.workflow.get({ tenantId: tenant.id, workflowId: workflow.id });
    expect(fetched).toMatchObject({ id: workflow.id, identifier: workflow.identifier });

    let updated = await forge.workflow.update({
      tenantId: tenant.id,
      workflowId: workflow.id,
      name: 'Updated Workflow Name'
    });
    expect(updated.name).toBe('Updated Workflow Name');

    let row = await db.workflow.findUniqueOrThrow({ where: { id: workflow.id } });
    expect(row.name).toBe('Updated Workflow Name');
  });

  it('does not expose a workflow to another tenant', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    await expect(
      forge.workflow.get({ tenantId: other.id, workflowId: workflow.id })
    ).rejects.toThrow();

    await expect(
      forge.workflow.update({ tenantId: other.id, workflowId: workflow.id, name: 'Hacked' })
    ).rejects.toThrow();

    await expect(
      forge.workflow.delete({ tenantId: other.id, workflowId: workflow.id })
    ).rejects.toThrow();

    let row = await db.workflow.findUniqueOrThrow({ where: { id: workflow.id } });
    expect(row.status).toBe('active');
    expect(row.name).toBe(workflow.name);
  });

  it('deletes a workflow asynchronously', async () => {
    let tenant = await createTenant();
    let workflow = await createWorkflow(tenant.id);

    await forge.workflow.delete({ tenantId: tenant.id, workflowId: workflow.id });

    await eventually(async () => {
      let row = await db.workflow.findUniqueOrThrow({ where: { id: workflow.id } });
      expect(row.status).toBe('deleted');
      expect(row.deletedAt).not.toBeNull();
    });
  });
});
