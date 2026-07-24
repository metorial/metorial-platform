import { v } from '@lowerdeck/validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockDb: any;
let nextId = 0;

vi.mock('@metorial/db', () => ({
  ID: {
    generateId: vi.fn(async (type: string) => `${type}-${++nextId}`)
  },
  withTransaction: vi.fn(async callback => await callback(mockDb))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

import { Fabric } from '@metorial/fabric';
import { declareOrganizationLayout } from '../src/definitions/layout';
import { organizationLayoutService } from '../src/services/organizationLayout';

declareOrganizationLayout({
  identifier: 'test.layout',
  name: 'Test layout',
  ownership: 'user_organization',
  schema: v.object({ columns: v.number() }),
  default: { columns: 1 }
});

let user = { oid: 1n, id: 'usr_1' };
let organization = { oid: 2n, id: 'org_1' };
let actor = { oid: 3n, id: 'oac_1' };

describe('OrganizationLayoutService', () => {
  let types: any[];
  let layouts: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    nextId = 0;
    types = [];
    layouts = [];

    mockDb = {
      organizationLayoutType: {
        upsert: vi.fn(async ({ where, create, update }) => {
          let existing = types.find(type => type.identifier === where.identifier);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }

          let type = {
            oid: 10n,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          types.push(type);
          return type;
        })
      },
      organizationLayout: {
        upsert: vi.fn(async ({ where, create }) => {
          let key = where.typeOid_targetHash;
          let existing = layouts.find(
            layout => layout.typeOid === key.typeOid && layout.targetHash === key.targetHash
          );
          if (existing) return existing;

          let layout = {
            oid: 20n,
            ...create,
            type: types[0],
            user,
            organization,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          layouts.push(layout);
          return layout;
        }),
        findFirst: vi.fn(async ({ where }) =>
          layouts.find(
            layout =>
              where.targetHash.in.includes(layout.targetHash) &&
              (layout.id === where.OR[0].id ||
                layout.type.id === where.OR[1].type.id ||
                layout.type.identifier === where.OR[2].type.identifier)
          )
        ),
        update: vi.fn(async ({ where, data }) => {
          let layout = layouts.find(layout => layout.oid === where.oid);
          Object.assign(layout, data);
          return layout;
        })
      }
    };
  });

  it('materializes and resolves layouts in their own namespace', async () => {
    let [layout] = await organizationLayoutService.listOrganizationLayouts({
      user: user as any,
      organization: organization as any
    });

    expect(layout).toMatchObject({
      value: { columns: 1 },
      userOid: user.oid,
      organizationOid: organization.oid
    });
    await expect(
      organizationLayoutService.getOrganizationLayout({
        selector: layout.type.id,
        user: user as any,
        organization: organization as any
      })
    ).resolves.toMatchObject({ id: layout.id });
  });

  it('validates and updates layout values', async () => {
    await expect(
      organizationLayoutService.setOrganizationLayout({
        selector: 'test.layout',
        value: { columns: 'two' },
        user: user as any,
        organization: organization as any,
        performedBy: actor as any,
        context: {} as any
      })
    ).rejects.toThrow('The provided data is invalid');

    let layout = await organizationLayoutService.setOrganizationLayout({
      selector: 'test.layout',
      value: { columns: 2 },
      user: user as any,
      organization: organization as any,
      performedBy: actor as any,
      context: {} as any
    });

    expect(layout.value).toEqual({ columns: 2 });
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.layout.updated:after',
      expect.objectContaining({ layout })
    );
  });
});
