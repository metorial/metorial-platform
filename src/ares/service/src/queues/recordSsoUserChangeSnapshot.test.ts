import { describe, expect, it } from 'vitest';
import {
  byValueThenId,
  getChangedSsoUserFields,
  type SsoUserChangeSnapshot
} from './recordSsoUserChangeSnapshot';

let baseSnapshot = {
  user: {
    id: 'ssu_1',
    oid: '1',
    tenantOid: '10',
    status: 'active',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    ownerProfileOid: '100'
  },
  ownerProfile: {
    id: 'sup_1',
    oid: '100',
    status: 'active',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace'
  },
  assignedGroups: [
    { id: 'sgr_1', value: 'engineering', displayName: 'Engineering' }
  ],
  assignedRoles: [{ id: 'sro_1', value: 'admin', displayName: 'Admin' }]
} satisfies SsoUserChangeSnapshot;

let cloneSnapshot = (snapshot: SsoUserChangeSnapshot): SsoUserChangeSnapshot =>
  JSON.parse(JSON.stringify(snapshot));

describe('recordSsoUserChangeSnapshot', () => {
  it('sorts assignments by value and id', () => {
    expect(
      [
        { id: 'sgr_2', value: 'sales', displayName: 'Sales' },
        { id: 'sgr_3', value: 'engineering', displayName: 'Engineering 2' },
        { id: 'sgr_1', value: 'engineering', displayName: 'Engineering 1' }
      ].sort(byValueThenId)
    ).toEqual([
      { id: 'sgr_1', value: 'engineering', displayName: 'Engineering 1' },
      { id: 'sgr_3', value: 'engineering', displayName: 'Engineering 2' },
      { id: 'sgr_2', value: 'sales', displayName: 'Sales' }
    ]);
  });

  it('does not report changes for identical effective snapshots', () => {
    expect(getChangedSsoUserFields(baseSnapshot, cloneSnapshot(baseSnapshot))).toEqual(
      []
    );
  });

  it('reports assigned group and role changes explicitly', () => {
    let next = cloneSnapshot(baseSnapshot);
    next.assignedGroups = [
      ...next.assignedGroups,
      { id: 'sgr_2', value: 'sales', displayName: 'Sales' }
    ];
    next.assignedRoles = [
      { id: 'sro_2', value: 'member', displayName: 'Member' }
    ];

    expect(getChangedSsoUserFields(baseSnapshot, next)).toEqual([
      'assignedGroups',
      'assignedRoles'
    ]);
  });
});
