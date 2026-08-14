import { describe, expect, it, vi } from 'vitest';

// The generated client validates its env at import time, and imports are hoisted.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/mirror-plan-test';
  process.env.INTEGRATIONS_API_URL ??= 'http://localhost';
});

import { buildMirrorReferencePlan, type MirrorClient } from './mirrorReferences';

type FieldSpec = { name: string; kind?: string; type?: string; isList?: boolean };

let fakeClient = (
  models: Record<string, FieldSpec[]>,
  includeRuntime = true
): MirrorClient => {
  let client: any = {
    $connect: () => {},
    _request: () => {},
    notAModel: { someOtherProperty: true }
  };

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
              isList: field.isList ?? false
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
          .map(field => [
            field.name,
            { modelName: model, name: field.name, typeName: 'BigInt' }
          ])
      )
    };
  }

  return client as MirrorClient;
};

describe('buildMirrorReferencePlan', () => {
  it('pairs each legacy reference with the column backing its mirror relation', () => {
    let plan = buildMirrorReferencePlan(
      fakeClient({
        Skill: [
          { name: 'oid' },
          { name: 'tenantOid' },
          { name: 'tenant', kind: 'object', type: 'Tenant' },
          { name: 'projectOid' },
          { name: 'project', kind: 'object', type: 'Project' },
          { name: 'environmentOid' },
          { name: 'environment', kind: 'object', type: 'Environment' },
          { name: 'instanceOid' },
          { name: 'instance', kind: 'object', type: 'Instance' }
        ]
      })
    );

    expect(plan.fromTenant).toEqual([
      {
        model: 'Skill',
        delegate: 'skill',
        legacyField: 'tenantOid',
        mirrorField: 'projectOid'
      }
    ]);
    expect(plan.fromEnvironment).toEqual([
      {
        model: 'Skill',
        delegate: 'skill',
        legacyField: 'environmentOid',
        mirrorField: 'instanceOid'
      }
    ]);
  });

  it('ignores a same-named column that points at an unrelated model', () => {
    let plan = buildMirrorReferencePlan(
      fakeClient({
        ProviderRun: [
          { name: 'oid' },
          { name: 'instanceOid' },
          { name: 'instance', kind: 'object', type: 'SessionProviderInstance' },
          { name: 'tenantOid' },
          { name: 'projectOid' },
          { name: 'project', kind: 'object', type: 'Project' },
          { name: 'environmentOid' },
          { name: 'metorialInstanceOid' },
          { name: 'metorialInstance', kind: 'object', type: 'Instance' }
        ]
      })
    );

    expect(plan.fromEnvironment[0]?.mirrorField).toBe('metorialInstanceOid');
  });

  it('skips the models the mirrors are sourced from', () => {
    let plan = buildMirrorReferencePlan(
      fakeClient({
        Project: [
          { name: 'oid' },
          { name: 'tenantOid' },
          { name: 'tenant', kind: 'object', type: 'Tenant' }
        ],
        Instance: [
          { name: 'oid' },
          { name: 'environmentOid' },
          { name: 'environment', kind: 'object', type: 'Environment' }
        ]
      })
    );

    expect(plan.fromTenant).toEqual([]);
    expect(plan.fromEnvironment).toEqual([]);
  });

  it('leaves models without a legacy reference out of the plan', () => {
    let plan = buildMirrorReferencePlan(
      fakeClient({ SkillItem: [{ name: 'oid' }, { name: 'skillOid' }] })
    );

    expect(plan.fromTenant).toEqual([]);
    expect(plan.fromEnvironment).toEqual([]);
  });

  it('refuses to guess when a scoped model has no mirror relation', () => {
    expect(() =>
      buildMirrorReferencePlan(
        fakeClient({
          Widget: [
            { name: 'oid' },
            { name: 'tenantOid' },
            { name: 'tenant', kind: 'object', type: 'Tenant' }
          ]
        })
      )
    ).toThrow(/Widget has tenantOid but 0 single relations to Project/);
  });

  it('refuses to guess when a scoped model has two mirror relations', () => {
    expect(() =>
      buildMirrorReferencePlan(
        fakeClient({
          Widget: [
            { name: 'oid' },
            { name: 'tenantOid' },
            { name: 'projectOid' },
            { name: 'project', kind: 'object', type: 'Project' },
            { name: 'previousProjectOid' },
            { name: 'previousProject', kind: 'object', type: 'Project' }
          ]
        })
      )
    ).toThrow(/2 single relations to Project/);
  });

  it('refuses to run when the relation metadata is unavailable', () => {
    expect(() =>
      buildMirrorReferencePlan(
        fakeClient({ Skill: [{ name: 'oid' }, { name: 'tenantOid' }] }, false)
      )
    ).toThrow(/runtime data model is unavailable/);
  });
});

describe('buildMirrorReferencePlan against the generated client', () => {
  it('resolves a mirror for every scoped model in the real schema', async () => {
    let { db } = await import('@metorial-subspace/db');

    let plan = buildMirrorReferencePlan(db as unknown as MirrorClient);

    expect(plan.fromTenant.length).toBeGreaterThan(80);
    expect(plan.fromEnvironment.length).toBeGreaterThan(50);

    for (let reference of [...plan.fromTenant, ...plan.fromEnvironment]) {
      expect(reference.mirrorField).toMatch(/Oid$/);
    }

    let providerRun = plan.fromEnvironment.find(
      reference => reference.model === 'ProviderRun'
    );
    expect(providerRun?.mirrorField).toBe('metorialInstanceOid');

    expect(plan.fromTenant.map(reference => reference.model)).not.toContain('Project');
    expect(plan.fromEnvironment.map(reference => reference.model)).not.toContain('Instance');
  });
});
