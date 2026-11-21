import { describe, expect, it } from 'vitest';
import { entityListWhere, entitySearchWhere } from '../src/lib/listWhere';

let base = { organizationOid: 1n, statuses: ['managed' as const, 'discovered' as const] };

describe('entity list filter', () => {
  it('leaves ids out unless given', () => {
    let where = entityListWhere(base);

    expect(where.id).toBeUndefined();
    expect(where.status).toEqual({ in: ['managed', 'discovered'] });
  });

  it('looks up a batch of ids', () => {
    expect(entityListWhere({ ...base, ids: ['aten_1', 'aten_2'] }).id).toEqual({
      in: ['aten_1', 'aten_2']
    });
  });

  it('combines with kinds, scope and search', () => {
    let where = entityListWhere({
      ...base,
      kinds: ['user'],
      ids: ['aten_1'],
      scopeInstanceOid: 7n,
      search: 'Ada'
    });

    expect(where).toMatchObject({ kind: { in: ['user'] }, id: { in: ['aten_1'] } });
    expect(where.AND).toHaveLength(2);
  });
});

describe('entity search', () => {
  it('searches identifiers of every type, or of one type when asked', () => {
    expect(JSON.stringify(entitySearchWhere('ada'))).not.toContain('"type"');
    expect(JSON.stringify(entitySearchWhere('ada', { identifierType: 'email' }))).toContain(
      '"type":"email"'
    );
  });
});
