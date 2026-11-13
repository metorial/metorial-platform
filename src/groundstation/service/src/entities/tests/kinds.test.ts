import { describe, expect, it } from 'vitest';
import type { EntityKind } from '../../../prisma/generated/client';
import {
  isCustomKindKey,
  isCustomerManagedKind,
  isValidKindKey,
  mergeKindDefinitions,
  resolveKindDefinition
} from '../kinds';

let record = (input: Partial<EntityKind> & { key: string }): EntityKind => ({
  oid: 1n,
  id: `gek_${input.key}`,
  name: input.key,
  cardinality: 'single',
  attributes: {},
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  organizationOid: 1n,
  ...input
});

describe('kind keys', () => {
  it('accepts built-in and custom keys', () => {
    expect(isValidKindKey('team')).toBe(true);
    expect(isValidKindKey('custom:department')).toBe(true);
    expect(isValidKindKey('custom:product-line_2')).toBe(true);
  });

  it('rejects unknown and malformed keys', () => {
    expect(isValidKindKey('department')).toBe(false);
    expect(isCustomKindKey('custom:')).toBe(false);
    expect(isCustomKindKey('custom:Department')).toBe(false);
    expect(isCustomKindKey('custom:-x')).toBe(false);
    expect(isCustomKindKey(`custom:${'a'.repeat(64)}`)).toBe(false);
  });

  it('knows which kinds customers manage', () => {
    expect(isCustomerManagedKind('team')).toBe(true);
    expect(isCustomerManagedKind('cost_center')).toBe(true);
    expect(isCustomerManagedKind('custom:department')).toBe(true);
    expect(isCustomerManagedKind('user')).toBe(false);
    expect(isCustomerManagedKind('repo')).toBe(false);
  });
});

describe('mergeKindDefinitions', () => {
  it('returns the built-in defaults without overrides', () => {
    let kinds = mergeKindDefinitions([]);
    let byKey = new Map(kinds.map(kind => [kind.key, kind]));

    expect(kinds.map(kind => kind.key)).toEqual([
      'user',
      'device',
      'client_user',
      'client_installation',
      'agent',
      'repo',
      'workspace',
      'team',
      'project',
      'cost_center'
    ]);
    expect(kinds.every(kind => kind.builtIn)).toBe(true);

    expect(byKey.get('team')).toMatchObject({ cardinality: 'multi', tagOrigins: ['source'] });
    expect(byKey.get('cost_center')).toMatchObject({
      cardinality: 'single',
      tagOrigins: ['source']
    });
    expect(byKey.get('project')).toMatchObject({
      cardinality: 'single',
      tagOrigins: ['source', 'repo']
    });
    expect(byKey.get('workspace')!.tagOrigins).toEqual(['source', 'repo']);

    for (let key of ['user', 'device', 'client_user', 'client_installation']) {
      expect(byKey.get(key)).toMatchObject({ taggable: false, tagOrigins: [] });
    }
  });

  it('applies organization overrides to built-ins', () => {
    let kinds = mergeKindDefinitions([
      record({
        key: 'project',
        name: 'Initiative',
        cardinality: 'multi',
        attributes: { description: 'Business initiatives', tagOrigins: ['source'] }
      })
    ]);
    let project = kinds.find(kind => kind.key == 'project')!;

    expect(project).toMatchObject({
      builtIn: true,
      name: 'Initiative',
      cardinality: 'multi',
      description: 'Business initiatives',
      tagOrigins: ['source']
    });
    expect(project.record?.id).toBe('gek_project');
  });

  it('ignores overrides that built-in kinds do not allow', () => {
    let user = resolveKindDefinition(
      'user',
      record({ key: 'user', cardinality: 'multi', attributes: { tagOrigins: ['repo'] } })
    )!;

    expect(user.cardinality).toBe('single');
    expect(user.tagOrigins).toEqual([]);
  });

  it('appends custom kinds sorted by key and skips archived ones', () => {
    let kinds = mergeKindDefinitions([
      record({ key: 'custom:product', name: 'Product', cardinality: 'multi' }),
      record({ key: 'custom:department', name: 'Department' }),
      record({ key: 'custom:legacy', name: 'Legacy', archivedAt: new Date() })
    ]);
    let custom = kinds.filter(kind => !kind.builtIn);

    expect(custom.map(kind => kind.key)).toEqual(['custom:department', 'custom:product']);
    expect(custom[0]).toMatchObject({
      name: 'Department',
      taggable: true,
      tagOrigins: ['source', 'repo']
    });
    expect(custom[1]!.cardinality).toBe('multi');
  });

  it('does not resolve undefined or archived custom kinds', () => {
    expect(resolveKindDefinition('custom:missing', null)).toBeNull();
    expect(
      resolveKindDefinition(
        'custom:gone',
        record({ key: 'custom:gone', archivedAt: new Date() })
      )
    ).toBeNull();
  });
});
