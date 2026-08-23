import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-access', () => ({
  createResourceAuthorization: ({
    restricted,
    resourceActor,
    accessTags
  }: {
    restricted: boolean;
    resourceActor?: unknown;
    accessTags?: unknown;
  }) =>
    restricted
      ? { type: 'restricted', resourceActor, accessTags }
      : { type: 'privileged', resourceActor }
}));

import {
  getInstanceCargoAccess,
  getInstanceCargoActorInput,
  hasInstanceConsumerAccess
} from './cargoAccess';

beforeEach(() => {
  vi.clearAllMocks();
});

let project = { oid: 7n, id: 'prj_1' } as any;
let instance = {
  oid: 1n,
  id: 'ins_1',
  projectOid: project.oid
};
let profileActor = {
  oid: 6n,
  id: 'rac_1',
  identifier: 'mte-cpf-cpf_1',
  name: 'Portal Profile',
  projectOid: project.oid,
  consumerProfileOid: 2n
} as any;

describe('cargoAccess', () => {
  it('treats consumer-only requests as consumer-scoped', () => {
    expect(
      hasInstanceConsumerAccess({
        instance,
        project,
        consumerProfile: {
          oid: 2n,
          id: 'cpf_1',
          name: 'Portal Profile',
          instanceOid: 1n,
          consumer: {
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toBe(true);
  });

  it('keeps member requests on the member bypass path', () => {
    expect(
      hasInstanceConsumerAccess({
        instance,
        project,
        member: {
          actor: {
            id: 'ora_1',
            name: 'Org Actor'
          }
        } as any,
        consumerProfile: {
          oid: 2n,
          id: 'cpf_1',
          name: 'Portal Profile',
          instanceOid: 1n,
          consumer: {
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toBe(false);
  });

  it('maps consumer requests to a local Cargo actor input', () => {
    expect(
      getInstanceCargoActorInput({
        instance,
        project,
        consumerProfile: {
          oid: 2n,
          id: 'cpf_1',
          name: 'Portal Profile',
          instanceOid: 1n,
          consumer: {
            oid: 1n,
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toEqual({
      identifier: 'mte-cpf-cpf_1',
      name: 'Portal Profile',
      consumerProfileOid: 2n
    });
  });

  it('maps members to a full-access local Cargo actor input', () => {
    expect(
      getInstanceCargoActorInput({
        instance,
        project,
        member: {
          actor: {
            oid: 2n,
            id: 'ora_1',
            name: 'Organization Actor'
          }
        } as any
      })
    ).toEqual({
      identifier: 'mte-oac-ora_1',
      name: 'Organization Actor',
      organizationActorOid: 2n
    });
  });

  it('passes the normalized instance scope, profile actor, and consumer access tags', async () => {
    let accessTags = [{ accessTagOid: 3n }];

    let access = await getInstanceCargoAccess({
      instance,
      project,
      resourceActor: profileActor,
      consumerProfile: {
        oid: 2n,
        id: 'cpf_1',
        name: 'Portal Profile',
        instanceOid: 1n,
        consumer: {
          oid: 1n,
          id: 'con_1',
          name: 'Portal Consumer'
        } as any
      },
      accessTags
    });

    expect(access).toEqual({
      project,
      instance,
      authorization: {
        type: 'restricted',
        resourceActor: profileActor,
        accessTags
      },
      actor: profileActor,
      actorId: 'rac_1',
      accessTags,
      defaultPermissions: undefined,
      overridePermissions: undefined
    });
  });

  it('preserves full Cargo access for organization members', async () => {
    let access = await getInstanceCargoAccess({
      instance,
      project,
      resourceActor: profileActor,
      member: {
        actor: {
          oid: 2n,
          id: 'ora_1',
          name: 'Organization Actor'
        }
      } as any
    });

    expect(access).toEqual({
      project,
      instance,
      authorization: {
        type: 'privileged',
        resourceActor: profileActor
      },
      actor: profileActor,
      actorId: 'rac_1',
      accessTags: undefined,
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
  });
});
