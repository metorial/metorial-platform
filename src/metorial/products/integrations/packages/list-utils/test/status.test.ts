import { describe, expect, it } from 'vitest';
import { normalizeStatusForList } from '../src/status';

describe('normalizeStatusForList', () => {
  it('matches nothing when only deleted is requested without allowDeleted', () => {
    let filter = normalizeStatusForList({ status: ['deleted'] });

    expect(filter.noParent.status).toEqual({ in: [] });
    expect(filter.hasParent).toEqual({ status: { in: [] }, isParentDeleted: false });
  });

  it('drops deleted from a mixed filter without allowDeleted', () => {
    expect(normalizeStatusForList({ status: ['active', 'deleted'] }).noParent.status).toEqual({
      in: ['active']
    });
  });

  it('keeps deleted when allowDeleted is set', () => {
    expect(
      normalizeStatusForList({ status: ['deleted'], allowDeleted: true }).noParent.status
    ).toEqual({ in: ['deleted'] });
  });
});
