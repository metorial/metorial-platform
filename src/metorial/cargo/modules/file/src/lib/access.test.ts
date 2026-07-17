import { describe, expect, it } from 'vitest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from './access';

let member = {
  actor: {
    oid: 1n,
    id: 'oac_member',
    name: 'Member'
  }
};

let consumerProfile = {
  consumer: {
    oid: 2n,
    id: 'con_consumer',
    name: 'Consumer'
  }
};

describe('local Cargo access', () => {
  it('prefers member access over consumer access', () => {
    let access = getInstanceCargoAccess({
      member,
      consumerProfile
    });

    expect(access).toEqual({
      accessActor: {
        identifier: 'mte-oac-oac_member',
        name: 'Member',
        organizationActorOid: 1n
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
    expect(hasInstanceConsumerAccess({ member, consumerProfile })).toBe(false);
  });

  it('uses consumer access without member permissions', () => {
    expect(getInstanceCargoAccess({ consumerProfile })).toEqual({
      accessActor: {
        identifier: 'mte-con-con_consumer',
        name: 'Consumer',
        consumerOid: 2n
      }
    });
    expect(hasInstanceConsumerAccess({ consumerProfile })).toBe(true);
  });
});
