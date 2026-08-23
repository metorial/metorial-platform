import { describe, expect, it, vi } from 'vitest';

// The generated client validates its env at import time, and imports are hoisted.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/scoped-plan-test';
  process.env.INTEGRATIONS_API_URL ??= 'http://localhost';
});

import { buildScopedModelPlan, type ScopedClient } from './tenantScopedReferences';

type FieldSpec = { name: string; kind?: string; type?: string };

let fakeClient = (
  models: Record<string, FieldSpec[]>,
  includeRuntime = true
): ScopedClient => {
  let client: any = { $connect: () => {}, notAModel: { someOtherProperty: true } };

  if (includeRuntime) {
    client._runtimeDataModel = {
      models: Object.fromEntries(
        Object.entries(models).map(([model, fields]) => [
          model,
          {
            fields: fields.map(field => ({
              name: field.name,
              kind: field.kind ?? 'scalar',
              type: field.type ?? 'BigInt',
              isList: false
            }))
          }
        ])
      )
    };
  }

  for (let [model, fields] of Object.entries(models)) {
    let delegate = model[0]!.toLowerCase() + model.slice(1);
    client[delegate] = {
      fields: Object.fromEntries(
        fields
          .filter(field => (field.kind ?? 'scalar') !== 'object')
          .map(field => [field.name, { modelName: model, name: field.name }])
      )
    };
  }

  return client as ScopedClient;
};

describe('buildScopedModelPlan', () => {
  it('splits models by how they are scoped', () => {
    let plan = buildScopedModelPlan(
      fakeClient({
        Session: [{ name: 'oid' }, { name: 'tenantOid' }, { name: 'environmentOid' }],
        Brand: [{ name: 'oid' }, { name: 'tenantOid' }],
        Callback: [{ name: 'oid' }, { name: 'environmentOid' }],
        SkillItem: [{ name: 'oid' }, { name: 'skillOid' }]
      })
    );

    expect(plan.environmentScoped).toEqual([
      { model: 'Callback', delegate: 'callback', hasTenantOid: false },
      { model: 'Session', delegate: 'session', hasTenantOid: true }
    ]);
    expect(plan.tenantScopedOnly).toEqual([
      { model: 'Brand', delegate: 'brand', hasTenantOid: true }
    ]);
  });

  it('leaves the scopes and their mirrors out of both lists', () => {
    let plan = buildScopedModelPlan(
      fakeClient({
        Tenant: [{ name: 'oid' }],
        Environment: [{ name: 'oid' }, { name: 'tenantOid' }],
        Project: [{ name: 'oid' }, { name: 'tenantOid' }],
        Instance: [{ name: 'oid' }, { name: 'environmentOid' }]
      })
    );

    expect(plan.environmentScoped).toEqual([]);
    expect(plan.tenantScopedOnly).toEqual([]);
  });

  it('refuses to run when the relation metadata is unavailable', () => {
    expect(() =>
      buildScopedModelPlan(
        fakeClient({ Session: [{ name: 'oid' }, { name: 'tenantOid' }] }, false)
      )
    ).toThrow(/runtime data model is unavailable/);
  });
});

describe('buildScopedModelPlan against the generated client', () => {
  it('finds the scoped models of the real schema', async () => {
    let { db } = await import('@metorial-subspace/db');

    let plan = buildScopedModelPlan(db as unknown as ScopedClient);

    expect(plan.environmentScoped.length).toBeGreaterThan(40);
    expect(plan.tenantScopedOnly.length).toBeGreaterThan(20);

    let models = plan.environmentScoped.map(entry => entry.model);
    expect(models).toContain('Session');
    expect(models).not.toContain('Instance');

    // Everything that would have to move with an environment carries the denormalized tenantOid.
    expect(plan.environmentScoped.find(entry => entry.model === 'Session')?.hasTenantOid).toBe(
      true
    );

    let tenantOnly = plan.tenantScopedOnly.map(entry => entry.model);
    expect(tenantOnly).toContain('Brand');
    expect(tenantOnly).not.toContain('Session');
    expect(tenantOnly).not.toContain('Project');
  });
});
