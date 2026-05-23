import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Secret, SecretType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { getId } from '../id';

let include = {};
type SecretDbClient = Pick<typeof db, 'secret'>;

export type SecretRegistryCredentials = {
  registryUrl: string;
  username: string;
  password: string;
};

export type SecretServerConfigConfig = {
  // env: Record<string, string>;
  // command?: string[];

  input: Record<string, unknown>;
  transformed: any;
};

export type SecretOAuthConnectionCredentials = {
  clientId: string;
  clientSecret?: string;
};

export type SecretOAuthToken = {
  accessToken: string;
  refreshToken?: string;
};

export type SecretTypes = {
  registry_credentials: SecretRegistryCredentials;
  server_config_value: SecretServerConfigConfig;
  oauth_connection_credentials: SecretOAuthConnectionCredentials;
  oauth_token: SecretOAuthToken;
};

class secretServiceImpl {
  async getSecretById(d: { id: string; tenant: Tenant }) {
    let secret = await db.secret.findFirst({
      where: {
        id: d.id,
        status: 'active',
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!secret) throw new ServiceError(notFoundError('secret'));
    return secret;
  }

  async listSecrets(d: { tenant: Tenant; type?: SecretType }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.secret.findMany({
            ...opts,
            where: {
              type: d.type,
              status: 'active',
              tenantOid: d.tenant.oid
            },
            include
          })
      )
    );
  }

  async createSecret<Type extends keyof SecretTypes>(d: {
    tenant: Tenant;
    purpose: Type;
    secretData: SecretTypes[Type];
  }) {
    let encrypted = await encryption.encrypt({
      secret: JSON.stringify(d.secretData),
      entityId: String(d.tenant.oid)
    });

    return await db.secret.create({
      data: {
        ...getId('secret'),
        type: d.purpose,
        status: 'active',
        tenantOid: d.tenant.oid,
        encryptedSecret: encrypted
      }
    });
  }

  async DANGEROUSLY_decryptSecret<Type extends keyof SecretTypes>(
    d: ({ secret: Secret } | { secretOid: bigint }) & {
      purpose: Type;
      tenant: Tenant;
      db?: SecretDbClient;
    }
  ) {
    let client = d.db ?? db;
    let secret =
      'secret' in d
        ? d.secret
        : await client.secret.findUniqueOrThrow({ where: { oid: d.secretOid } });
    if (secret.tenantOid !== d.tenant.oid) {
      throw new Error('WTF - Secret tenant mismatch');
    }

    if (secret.type !== d.purpose) {
      throw new Error('WTF - Secret purpose mismatch');
    }
    if (secret.status !== 'active') {
      throw new ServiceError(notFoundError('secret'));
    }

    let decrypted = await encryption.decrypt({
      entityId: String(secret.tenantOid),
      encrypted: secret.encryptedSecret
    });

    return JSON.parse(decrypted) as SecretTypes[Type];
  }

  async DANGEROUSLY_updateSecret<Type extends keyof SecretTypes>(
    d: ({ secret: Secret } | { secretOid: bigint }) & {
      purpose: Type;
      tenant: Tenant;
      secretData: SecretTypes[Type];
      db?: SecretDbClient;
    }
  ) {
    let client = d.db ?? db;
    let secret =
      'secret' in d
        ? d.secret
        : await client.secret.findUniqueOrThrow({ where: { oid: d.secretOid } });
    if (secret.type !== d.purpose) {
      throw new Error('WTF - Secret purpose mismatch');
    }
    if (secret.tenantOid !== d.tenant.oid) {
      throw new Error('WTF - Secret tenant mismatch');
    }

    let encrypted = await encryption.encrypt({
      secret: JSON.stringify(d.secretData),
      entityId: String(secret.tenantOid)
    });

    return await client.secret.update({
      where: { oid: secret.oid },
      data: { encryptedSecret: encrypted }
    });
  }

  async DANGEROUSLY_deleteSecret(
    d: ({ secret: Secret } | { secretOid: bigint }) & { tenant: Tenant; db?: SecretDbClient }
  ) {
    let client = d.db ?? db;
    let secret =
      'secret' in d
        ? d.secret
        : await client.secret.findUniqueOrThrow({ where: { oid: d.secretOid } });
    if (secret.tenantOid !== d.tenant.oid) {
      throw new Error('WTF - Secret tenant mismatch');
    }

    return await client.secret.update({
      where: { oid: secret.oid },
      data: { status: 'deleted', encryptedSecret: '' }
    });
  }
}

export let secretService = Service.create(
  'secretService',
  () => new secretServiceImpl()
).build();
