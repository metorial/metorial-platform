import { describe, expect, it } from 'vitest';
import { createResourceAuthorization } from '../src/services/resourceAuthorization';

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

  it('rejects consumer-only actors', () => {
    expect(() =>
      createResourceAuthorization({
        restricted: false,
        resourceActor: {
          consumerOid: 4n,
          consumerProfileOid: null
        } as any
      })
    ).toThrow('must be linked to a consumer profile');
  });
});
