import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    instance: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() }
  }
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: {}
}));

vi.mock(
  '@metorial/module-access',
  async () =>
    await vi.importActual(
      '../../../../../core/modules/access/src/services/resourceAuthorization'
    )
);

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
let project = {
  oid: 14n,
  id: 'prj_1'
};
let instance = {
  oid: consumerProfile.instanceOid,
  projectOid: project.oid
};
let memberResourceActor = {
  oid: 12n,
  id: 'rac_member',
  identifier: 'mte-oac-oac_member',
  name: 'Member',
  type: 'external' as const,
  projectOid: project.oid,
  organizationActorOid: member.actor.oid,
  consumerOid: null,
  consumerProfileOid: null,
  resourceTenantOid: null,
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
let scopeContext = { project, instance };

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
        project,
        instance
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
        project,
        instance
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
