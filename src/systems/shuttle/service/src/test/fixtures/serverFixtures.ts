import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  Server,
  Tenant
} from '../../../prisma/generated/client';
import { ServerType } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { TenantFixtures } from './tenantFixtures';

export const ServerFixtures = (db: PrismaClient) => {
  const defaultServer = async (data: {
    tenantOid: bigint;
    overrides?: Partial<Server>;
  }): Promise<Server> => {
    const { oid, id } = getId('server');
    const name = data.overrides?.name ?? `Test Server ${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Server>(
      {
        oid,
        id,
        type: ServerType.container,
        name,
        description: data.overrides?.description ?? null,
        draftConfigSchema: data.overrides?.draftConfigSchema ?? {
          type: 'object',
          properties: {}
        },
        draftConfigTransformer: data.overrides?.draftConfigTransformer ?? '$.config',
        draftRemoteUrl: data.overrides?.draftRemoteUrl ?? null,
        draftRemoteProtocol: data.overrides?.draftRemoteProtocol ?? null,
        draftRepositoryTagOid: data.overrides?.draftRepositoryTagOid ?? null,
        tenantOid: data.tenantOid,
        currentVersionOid: data.overrides?.currentVersionOid ?? null,
        remoteOauthConfigOid: data.overrides?.remoteOauthConfigOid ?? null,
        delegatedOauthConfigOid: data.overrides?.delegatedOauthConfigOid ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.overrides
      } as Server,
      {
        persist: value => db.server.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
  }): Promise<Server & { tenant: Tenant }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const server = await defaultServer({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });

    return db.server.findUniqueOrThrow({
      where: { id: server.id },
      include: { tenant: true }
    }) as Promise<Server & { tenant: Tenant }>;
  };

  const withDescription = async (
    description: string,
    data: {
      tenantOid: bigint;
      overrides?: Partial<Server>;
    }
  ): Promise<Server> =>
    defaultServer({
      ...data,
      overrides: {
        ...data.overrides,
        description
      }
    });

  const global = async (data?: { overrides?: Partial<Server> }): Promise<Server> => {
    const { oid, id } = getId('server');
    const name = data?.overrides?.name ?? `Global Server ${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Server>(
      {
        oid,
        id,
        type: ServerType.container,
        name,
        description: data?.overrides?.description ?? null,
        draftConfigSchema: data?.overrides?.draftConfigSchema ?? {
          type: 'object',
          properties: {}
        },
        draftConfigTransformer: data?.overrides?.draftConfigTransformer ?? '$.config',
        draftRemoteUrl: data?.overrides?.draftRemoteUrl ?? null,
        draftRemoteProtocol: data?.overrides?.draftRemoteProtocol ?? null,
        draftRepositoryTagOid: data?.overrides?.draftRepositoryTagOid ?? null,
        tenantOid: null,
        currentVersionOid: data?.overrides?.currentVersionOid ?? null,
        remoteOauthConfigOid: data?.overrides?.remoteOauthConfigOid ?? null,
        delegatedOauthConfigOid: data?.overrides?.delegatedOauthConfigOid ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data?.overrides
      } as Server,
      {
        persist: value => db.server.create({ data: value })
      }
    );

    return factory.create(data?.overrides ?? {});
  };

  return {
    default: defaultServer,
    global,
    withTenant,
    withDescription
  };
};
