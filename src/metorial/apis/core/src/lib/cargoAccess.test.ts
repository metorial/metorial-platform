import { describe, expect, it, vi } from 'vitest';

let { findInstanceMock, upsertActorMock } = vi.hoisted(() => ({
  findInstanceMock: vi.fn(),
  upsertActorMock: vi.fn()
}));

vi.mock('@metorial/module-resource-tenant', () => ({
  resourceActorService: {
    upsertActor: upsertActorMock
  }
}));
vi.mock('@metorial/db', () => ({
  db: {
    instance: {
      findUnique: findInstanceMock
    }
  }
}));

import {
  getInstanceCargoAccess,
  getInstanceCargoActorInput,
  hasInstanceConsumerAccess
} from './cargoAccess';

describe('cargoAccess', () => {
  it('treats consumer-only requests as consumer-scoped', () => {
    expect(
      hasInstanceConsumerAccess({
        instance: { id: 'ins_1' },
        consumerProfile: {
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
        instance: { id: 'ins_1' },
        member: {
          actor: {
            id: 'ora_1',
            name: 'Org Actor'
          }
        } as any,
        consumerProfile: {
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
        instance: { id: 'ins_1' },
        consumerProfile: {
          consumer: {
            oid: 1n,
            id: 'con_1',
            name: 'Portal Consumer'
          } as any
        }
      })
    ).toEqual({
      identifier: 'mte-con-con_1',
      name: 'Portal Consumer',
      consumerOid: 1n
    });
  });

  it('maps members to a full-access local Cargo actor input', () => {
    expect(
      getInstanceCargoActorInput({
        instance: { id: 'ins_1' },
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

  it('passes consumer access tags into native Cargo authorization', async () => {
    let accessTags = [{ accessTagOid: 3n }];
    findInstanceMock.mockResolvedValue({
      resourceTenant: { oid: 4n, id: 'rtn_1' },
      resourceGroup: { oid: 5n, id: 'rgr_1' }
    });
    upsertActorMock.mockResolvedValue({
      oid: 6n,
      id: 'rac_1'
    });

    let access = await getInstanceCargoAccess({
      instance: { id: 'ins_1' },
      consumerProfile: {
        consumer: {
          oid: 1n,
          id: 'con_1',
          name: 'Portal Consumer'
        } as any
      },
      accessTags
    });

    expect(access).toEqual({
      resourceTenant: { oid: 4n, id: 'rtn_1' },
      resourceGroup: { oid: 5n, id: 'rgr_1' },
      actor: { oid: 6n, id: 'rac_1' },
      actorId: 'rac_1',
      accessTags,
      defaultPermissions: undefined,
      overridePermissions: undefined
    });
  });
});
