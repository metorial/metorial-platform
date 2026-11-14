import { describe, expect, it } from 'vitest';
import {
  assertDistinctStoreResourceAccessRoles,
  consumerStoreWriteRoles,
  getImpliedStoreResourceAccessLevels,
  skillStoreResourceAccess,
  standaloneStoreResourceAccess,
  storeResourceAccessLevels,
  type StoreResourceAccessDefinition
} from '../src/definitions';

describe('store resource access definitions', () => {
  it.each([
    ['skill', skillStoreResourceAccess],
    ['store', standaloneStoreResourceAccess]
  ])('gives every level of the %s kind its own roles', (_, access) => {
    expect(() => assertDistinctStoreResourceAccessRoles(access)).not.toThrow();

    let roles = storeResourceAccessLevels.flatMap(level => access.policies[level].roles);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('gives every level its own policy identifier', () => {
    for (let access of [skillStoreResourceAccess, standaloneStoreResourceAccess]) {
      let identifiers = storeResourceAccessLevels.map(
        level => access.policies[level].systemIdentifier
      );
      expect(new Set(identifiers).size).toBe(identifiers.length);
    }
  });

  it('keeps the skill and store kinds on separate policies', () => {
    let skillRoles = storeResourceAccessLevels.flatMap(
      level => skillStoreResourceAccess.policies[level].roles
    );
    let storeRoles = storeResourceAccessLevels.flatMap(
      level => standaloneStoreResourceAccess.policies[level].roles
    );

    expect(skillRoles.filter(role => storeRoles.includes(role))).toEqual([]);
  });

  it('rejects a kind whose levels share a role', () => {
    let access: StoreResourceAccessDefinition = {
      ...standaloneStoreResourceAccess,
      policies: {
        ...standaloneStoreResourceAccess.policies,
        manage: {
          ...standaloneStoreResourceAccess.policies.manage,
          roles: [...consumerStoreWriteRoles]
        }
      }
    };

    expect(() => assertDistinctStoreResourceAccessRoles(access)).toThrow(
      /consumer#instance.store:write for both write and manage/
    );
  });

  it('implies the levels below the granted one', () => {
    expect(getImpliedStoreResourceAccessLevels('read')).toEqual(['read']);
    expect(getImpliedStoreResourceAccessLevels('write')).toEqual(['read', 'write']);
    expect(getImpliedStoreResourceAccessLevels('manage')).toEqual(['read', 'write', 'manage']);
  });
});
