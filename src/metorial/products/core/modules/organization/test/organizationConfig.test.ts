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
import {
  declareOrganizationConfig,
  getOrganizationConfigDeclarations
} from '../src/definitions/config';
import { organizationConfigService } from '../src/services/organizationConfig';

let userDeclaration = declareOrganizationConfig({
  identifier: 'test.user',
  name: 'User config',
  ownership: 'user',
  schema: v.object({ enabled: v.boolean() }),
  default: { enabled: false }
});

let declarations = [
  userDeclaration,
  declareOrganizationConfig({
    identifier: 'test.organization',
    name: 'Organization config',
    ownership: 'organization',
    schema: v.string(),
    default: 'default'
  }),
  declareOrganizationConfig({
    identifier: 'test.user_organization',
    name: 'User organization config',
    ownership: 'user_organization',
    schema: v.number(),
    default: 1
  })
];

let user = { oid: 1n, id: 'usr_1' };
let organization = { oid: 2n, id: 'org_1' };
let actor = { oid: 3n, id: 'oac_1' };

describe('organization config declarations', () => {
  it('rejects duplicate declarations', () => {
    expect(() =>
      declareOrganizationConfig({
        ...userDeclaration
      })
    ).toThrow('has already been declared');
  });

  it('rejects invalid defaults', () => {
    expect(() =>
      declareOrganizationConfig({
        identifier: 'test.invalid_default',
        name: 'Invalid',
        ownership: 'user',
        schema: v.string(),
        default: 42 as never
      })
    ).toThrow('is invalid');
  });
});

describe('OrganizationConfigService', () => {
  let types: any[];
  let configs: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    nextId = 0;
    types = [];
    configs = [];

    mockDb = {
      organizationConfigType: {
        upsert: vi.fn(async ({ where, create, update }) => {
          let existing = types.find(type => type.identifier === where.identifier);
          if (existing) {
            Object.assign(existing, update, { updatedAt: new Date() });
            return existing;
          }

          let type = {
            oid: BigInt(types.length + 10),
            ...create,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          types.push(type);
          return type;
        })
      },
      organizationConfig: {
        upsert: vi.fn(async ({ where, create }) => {
          let key = where.typeOid_targetHash;
          let existing = configs.find(
            config => config.typeOid === key.typeOid && config.targetHash === key.targetHash
          );
          if (existing) return existing;

          let type = types.find(type => type.oid === create.typeOid);
          let config = {
            oid: BigInt(configs.length + 20),
            ...create,
            type,
            user: create.userOid === user.oid ? user : null,
            organization: create.organizationOid === organization.oid ? organization : null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          configs.push(config);
          return config;
        }),
        findFirst: vi.fn(async ({ where }) =>
          configs.find(
            config =>
              where.targetHash.in.includes(config.targetHash) &&
              (config.id === where.OR[0].id ||
                config.type.id === where.OR[1].type.id ||
                config.type.identifier === where.OR[2].type.identifier)
          )
        ),
        update: vi.fn(async ({ where, data }) => {
          let config = configs.find(config => config.oid === where.oid);
          Object.assign(config, data, { updatedAt: new Date() });
          return config;
        })
      }
    };
  });

  it('materializes every ownership mode with stable isolated targets', async () => {
    let first = await organizationConfigService.listOrganizationConfigs({
      user: user as any,
      organization: organization as any
    });
    let second = await organizationConfigService.listOrganizationConfigs({
      user: user as any,
      organization: organization as any
    });

    expect(first).toHaveLength(getOrganizationConfigDeclarations().length);
    expect(configs).toHaveLength(getOrganizationConfigDeclarations().length);
    expect(second.map(config => config.id)).toEqual(first.map(config => config.id));
    expect(new Set(first.map(config => config.targetHash)).size).toBe(3);

    expect(first.find(config => config.type.identifier === 'test.user')).toMatchObject({
      userOid: user.oid,
      organizationOid: null,
      value: { enabled: false }
    });
    expect(first.find(config => config.type.identifier === 'test.organization')).toMatchObject(
      {
        userOid: null,
        organizationOid: organization.oid,
        value: 'default'
      }
    );
    expect(
      first.find(config => config.type.identifier === 'test.user_organization')
    ).toMatchObject({
      userOid: user.oid,
      organizationOid: organization.oid,
      value: 1
    });
  });

  it('resolves by config ID, type ID, and identifier', async () => {
    let materialized = await organizationConfigService.listOrganizationConfigs({
      user: user as any,
      organization: organization as any
    });
    let config = materialized[0];

    for (let selector of [config.id, config.type.id, config.type.identifier]) {
      await expect(
        organizationConfigService.getOrganizationConfig({
          selector,
          user: user as any,
          organization: organization as any
        })
      ).resolves.toMatchObject({ id: config.id });
    }
  });

  it('validates updates and fires lifecycle events', async () => {
    await expect(
      organizationConfigService.setOrganizationConfig({
        selector: 'test.user',
        value: { enabled: 'yes' },
        user: user as any,
        organization: organization as any,
        performedBy: actor as any,
        context: {} as any
      })
    ).rejects.toThrow('The provided data is invalid');

    let updated = await organizationConfigService.setOrganizationConfig({
      selector: 'test.user',
      value: { enabled: true },
      user: user as any,
      organization: organization as any,
      performedBy: actor as any,
      context: {} as any
    });

    expect(updated.value).toEqual({ enabled: true });
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.config.updated:before',
      expect.objectContaining({ input: { value: { enabled: true } } })
    );
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.config.updated:after',
      expect.objectContaining({ config: updated })
    );
  });

  it('rejects persisted ownership drift', async () => {
    types.push({
      oid: 10n,
      id: 'organizationConfigType-existing',
      identifier: 'test.user',
      name: 'Old name',
      ownership: 'organization',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(
      organizationConfigService.getOrganizationConfig({
        selector: 'test.user',
        user: user as any,
        organization: organization as any
      })
    ).rejects.toThrow('has changed ownership');
  });

  it('does not resolve another user target by config ID', async () => {
    let [config] = await organizationConfigService.listOrganizationConfigs({
      user: user as any,
      organization: organization as any
    });

    await expect(
      organizationConfigService.getOrganizationConfig({
        selector: config.id,
        user: { ...user, oid: 99n, id: 'usr_2' } as any,
        organization: organization as any
      })
    ).rejects.toThrow('could not be found');
  });
});
