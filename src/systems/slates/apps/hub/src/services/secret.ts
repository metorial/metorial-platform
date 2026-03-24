import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Secret, SecretType, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';
import { getId } from '../id';

let include = {};

export type SecretSlateInstanceOauthSetup = {
  input: Record<string, any>;
  callbackState?: Record<string, any>;
};

export type SecretSlateOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export type SecretSlateAuthConfig = {
  input?: Record<string, any>;
  output?: Record<string, any>;
};

export type SecretTypes = {
  slate_oauth_setup: SecretSlateInstanceOauthSetup;
  slate_oauth_credentials: SecretSlateOAuthCredentials;
  slate_authentication_configuration: SecretSlateAuthConfig;
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
    d: ({ secret: Secret } | { secretOid: bigint }) & { purpose: Type; tenant: Tenant }
  ) {
    let secret =
      'secret' in d
        ? d.secret
        : await db.secret.findUniqueOrThrow({ where: { oid: d.secretOid } });
    if (secret.tenantOid !== d.tenant.oid) {
      throw new Error('WTF - Secret tenant mismatch');
    }

    if (secret.type !== d.purpose) {
      throw new Error('WTF - Secret purpose mismatch');
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
    }
  ) {
    let secret =
      'secret' in d
        ? d.secret
        : await db.secret.findUniqueOrThrow({ where: { oid: d.secretOid } });
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

    return await db.secret.update({
      where: { oid: secret.oid },
      data: { encryptedSecret: encrypted }
    });
  }
}

export let secretService = Service.create(
  'secretService',
  () => new secretServiceImpl()
).build();
