import { afterEach, describe, expect, it } from 'vitest';
import {
  createResourceAuthorization,
  getResourceAuthorizationMode,
  isCanonicalResourceAuthorizationEnabled,
  isLegacyResourceAuthorizationEnabled
} from '../src/services/resourceAuthorization';

let previousMode = process.env.RESOURCE_AUTHORIZATION_MODE;

afterEach(() => {
  if (previousMode == null) {
    delete process.env.RESOURCE_AUTHORIZATION_MODE;
  } else {
    process.env.RESOURCE_AUTHORIZATION_MODE = previousMode;
  }
});

describe('resource authorization', () => {
  it('rejects a restricted profile paired with a sibling instance group', () => {
    expect(() =>
      createResourceAuthorization({
        restricted: true,
        resourceTenant: { oid: 1n } as any,
        resourceGroup: { oid: 2n, resourceTenantOid: 1n } as any,
        instance: {
          oid: 3n,
          resourceTenantOid: 1n,
          resourceGroupOid: 999n
        } as any,
        consumerProfile: { oid: 4n, instanceOid: 3n } as any,
        resourceActor: {
          oid: 5n,
          resourceTenantOid: 1n,
          consumerProfileOid: 4n
        } as any,
        accessTags: [{ accessTagOid: 6n }]
      })
    ).toThrow('does not match the selected instance ResourceScope');
  });

  it.each([
    ['legacy', true, false],
    ['both', true, true],
    ['canonical', false, true]
  ] as const)('supports the %s rollout mode', (mode, legacy, canonical) => {
    process.env.RESOURCE_AUTHORIZATION_MODE = mode;

    expect(getResourceAuthorizationMode()).toBe(mode);
    expect(isLegacyResourceAuthorizationEnabled()).toBe(legacy);
    expect(isCanonicalResourceAuthorizationEnabled()).toBe(canonical);
  });
});
