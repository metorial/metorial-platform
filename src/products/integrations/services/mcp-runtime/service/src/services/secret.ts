import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Secret, SecretType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { env } from '../env';
import { getId } from '../id';
import { getNebulaClient, getNebulaTenantForShuttleTenant } from '../nebula';

let buildSecretProof = (secret: Secret, tenant: Tenant) => ({
  shuttleSecretId: secret.id,
  tenantId: tenant.id,
  type: secret.type
});

let createNebulaSecret = async (d: {
  tenant: Tenant;
  secret: Secret;
  purpose: SecretType;
  secretData: unknown;
}) => {
  let nebulaTenant = await getNebulaTenantForShuttleTenant(d.tenant);
  let proof = buildSecretProof(d.secret, d.tenant);

  return await getNebulaClient().secret.create({
    tenantId: nebulaTenant.id,
    purpose: d.purpose,
    secret: JSON.stringify(d.secretData),
    proof,
    encryptionContext: {
      shuttleTenantId: d.tenant.id,
      shuttleSecretId: d.secret.id
    }
  });
};

let useNebulaSecret = async (d: { tenant: Tenant; secret: Secret; note: string }) => {
  if (!d.secret.nebulaSecretId) {
    throw new Error('Delegated secret is missing nebulaSecretId');
  }

  let nebulaTenant = await getNebulaTenantForShuttleTenant(d.tenant);

  return await getNebulaClient().secret.use({
    tenantId: nebulaTenant.id,
    secretId: d.secret.nebulaSecretId,
    proof: buildSecretProof(d.secret, d.tenant),
    note: d.note
  });
};

let updateNebulaSecret = async (d: {
  tenant: Tenant;
  secret: Secret;
  secretData: unknown;
}) => {
  if (!d.secret.nebulaSecretId) {
    throw new Error('Delegated secret is missing nebulaSecretId');
  }

  let nebulaTenant = await getNebulaTenantForShuttleTenant(d.tenant);

  return await getNebulaClient().secret.update({
    tenantId: nebulaTenant.id,
    secretId: d.secret.nebulaSecretId,
    secret: JSON.stringify(d.secretData),
    proof: buildSecretProof(d.secret, d.tenant),
    encryptionContext: {
      shuttleTenantId: d.tenant.id,
      shuttleSecretId: d.secret.id
    }
  });
};

let disableNebulaSecret = async (d: { tenant: Tenant; secret: Secret }) => {
  if (!d.secret.nebulaSecretId) {
    throw new Error('Delegated secret is missing nebulaSecretId');
  }

  let nebulaTenant = await getNebulaTenantForShuttleTenant(d.tenant);

  return await getNebulaClient().secret.disable({
    tenantId: nebulaTenant.id,
    secretId: d.secret.nebulaSecretId
  });
};

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
    if (!env.secrets.SHUTTLE_DELEGATE_SECRETS_TO_NEBULA) {
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
          encryptedSecret: encrypted,
          isDelegatedToNebula: false
        }
      });
    }

    let secret = await db.secret.create({
      data: {
        ...getId('secret'),
        type: d.purpose,
        status: 'active',
        tenantOid: d.tenant.oid,
        encryptedSecret: '',
        isDelegatedToNebula: true
      }
    });

    try {
      let nebulaSecret = await createNebulaSecret({
        tenant: d.tenant,
        secret,
        purpose: d.purpose,
        secretData: d.secretData
      });

      return await db.secret.update({
        where: { oid: secret.oid },
        data: { nebulaSecretId: nebulaSecret.id }
      });
    } catch (err) {
      await db.secret.delete({ where: { oid: secret.oid } });
      throw err;
    }
  }

  async DANGEROUSLY_decryptSecret<Type extends keyof SecretTypes>(
    d: ({ secret: Secret } | { secretOid: bigint }) & {
      purpose: Type;
      tenant: Tenant;
      note: string;
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

    if (secret.isDelegatedToNebula) {
      let used = await useNebulaSecret({
        tenant: d.tenant,
        secret,
        note: d.note
      });

      return JSON.parse(used.plaintext) as SecretTypes[Type];
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

    if (secret.isDelegatedToNebula) {
      await updateNebulaSecret({
        tenant: d.tenant,
        secret,
        secretData: d.secretData
      });

      return secret;
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

    if (secret.isDelegatedToNebula && secret.nebulaSecretId) {
      await disableNebulaSecret({
        tenant: d.tenant,
        secret
      });
    }

    return await client.secret.update({
      where: { oid: secret.oid },
      data: {
        status: 'deleted',
        encryptedSecret: '',
        nebulaSecretId: secret.isDelegatedToNebula ? null : undefined
      }
    });
  }
}

export let secretService = Service.create(
  'secretService',
  () => new secretServiceImpl()
).build();
