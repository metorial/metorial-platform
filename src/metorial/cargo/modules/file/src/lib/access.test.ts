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
  oid: 20n,
  id: 'cpf_consumer',
  name: 'Consumer Profile',
  instanceOid: 3n,
  consumer: {
    oid: 2n,
    id: 'con_consumer',
    name: 'Consumer'
  }
};
let resourceTenant = {
  oid: 10n,
  id: 'rtn_1',
  identifier: 'tenant',
  name: 'Tenant',
  image: null,
  organizationName: null,
  createdAt: new Date(0),
  updatedAt: new Date(0)
};
let resourceGroup = {
  oid: 11n,
  id: 'rgr_1',
  identifier: 'instance',
  name: 'Instance',
  type: 'production' as const,
  resourceTenantOid: resourceTenant.oid,
  createdAt: new Date(0),
  updatedAt: new Date(0)
};
let instance = {
  oid: consumerProfile.instanceOid,
  resourceTenantOid: resourceTenant.oid,
  resourceGroupOid: resourceGroup.oid
};
let memberResourceActor = {
  oid: 12n,
  id: 'rac_member',
  identifier: 'mte-oac-oac_member',
  name: 'Member',
  type: 'external' as const,
  resourceTenantOid: resourceTenant.oid,
  organizationActorOid: member.actor.oid,
  consumerOid: null,
  consumerProfileOid: null,
  createdAt: new Date(0),
  updatedAt: new Date(0)
};
let consumerResourceActor = {
  ...memberResourceActor,
  oid: 13n,
  id: 'rac_profile',
  identifier: 'mte-cpf-profile',
  name: 'Consumer',
  organizationActorOid: null,
  consumerOid: consumerProfile.consumer.oid,
  consumerProfileOid: consumerProfile.oid
};
let accessTags = [{ accessTagOid: 30n }];
let scopeContext = { resourceTenant, resourceGroup, instance };

describe('local Cargo access', () => {
  it('prefers member access over consumer access', () => {
    let access = getInstanceCargoAccess({
      member,
      consumerProfile,
      resourceActor: memberResourceActor,
      ...scopeContext
    });

    expect(access).toEqual({
      accessActor: {
        identifier: 'mte-oac-oac_member',
        name: 'Member',
        organizationActorOid: 1n
      },
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true,
      scope: {
        resourceTenant,
        resourceGroup
      },
      resourceActor: memberResourceActor,
      authorization: {
        type: 'privileged',
        resourceActor: memberResourceActor
      }
    });
    expect(
      hasInstanceConsumerAccess({
        member,
        consumerProfile,
        resourceActor: memberResourceActor,
        ...scopeContext
      })
    ).toBe(false);
  });

  it('uses consumer access without member permissions', () => {
    expect(
      getInstanceCargoAccess({
        consumerProfile,
        resourceActor: consumerResourceActor,
        accessTags,
        ...scopeContext
      })
    ).toEqual({
      accessActor: {
        identifier: 'mte-cpf-cpf_consumer',
        name: 'Consumer Profile',
        consumerProfileOid: 20n
      },
      scope: {
        resourceTenant,
        resourceGroup
      },
      resourceActor: consumerResourceActor,
      authorization: {
        type: 'restricted',
        resourceActor: consumerResourceActor,
        accessTags
      }
    });
    expect(
      hasInstanceConsumerAccess({
        consumerProfile,
        resourceActor: consumerResourceActor,
        accessTags,
        ...scopeContext
      })
    ).toBe(true);
  });
});
