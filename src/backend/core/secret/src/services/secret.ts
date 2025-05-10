import {
  db,
  ID,
  Organization,
  OrganizationActor,
  Secret,
  withTransaction
} from '@metorial/db';
import { forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { SecretType, secretTypes } from '../definitions';
import { getSecretFingerprint } from '../lib/fingerprint';
import { SecretStores } from '../store';

class SecretServiceImpl {
  private async ensureSecretActive(secret: Secret) {
    if (secret.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted secret'
        })
      );
    }
  }

  async createSecret(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    input: {
      type: SecretType;
      secretData: any;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let store = SecretStores.get(SecretStores.getDefault());
    let storeDefinition = await store.get();

    let type = await secretTypes[d.input.type];

    let json = JSON.stringify(d.input.secretData);

    let upcomingSecret: Secret = {
      oid: undefined as any,
      id: await ID.generateId('secret'),
      status: 'active',
      fingerprint: await getSecretFingerprint(d.input.type, json),
      description: d.input.description ?? null,
      metadata: d.input.metadata ?? {},
      typeOid: type.oid,
      storeOid: storeDefinition.oid,
      organizationOid: d.organization.oid,
      createdAt: new Date(),
      lastUsedAt: null,
      encryptedData: null
    };

    let encryptedData = await store.encryptSecret(upcomingSecret, json);

    return withTransaction(async db => {
      let secret = await db.secret.create({
        data: {
          ...upcomingSecret,
          encryptedData
        },
        include: {
          type: true,
          organization: true
        }
      });

      await db.secretEvent.createMany({
        data: {
          id: await ID.generateId('secretEvent'),
          type: 'secret_created',
          secretOid: secret.oid,
          organizationActorOid: d.performedBy.oid,
          metadata: {}
        }
      });

      return secret;
    });
  }

  async getSecretById(d: { secretId: string | bigint; organization: Organization }) {
    let secret = await db.secret.findFirst({
      where: {
        id: typeof d.secretId === 'string' ? d.secretId : undefined,
        oid: typeof d.secretId === 'bigint' ? d.secretId : undefined,

        organizationOid: d.organization.oid
      },
      include: {
        type: true,
        store: true,
        organization: true
      }
    });

    if (!secret) throw new ServiceError(notFoundError('secret', d.secretId.toString()));

    return secret;
  }

  async deleteSecret(d: {
    secret: Secret;
    performedBy: OrganizationActor;
    organization: Organization;
  }) {
    await this.ensureSecretActive(d.secret);

    return withTransaction(async db => {
      await db.secretEvent.createMany({
        data: {
          id: await ID.generateId('secretEvent'),
          type: 'secret_deleted',
          secretOid: d.secret.oid,
          organizationActorOid: d.performedBy.oid,
          metadata: {}
        }
      });

      return db.secret.update({
        where: { oid: d.secret.oid },
        data: { status: 'deleted', encryptedData: null },
        include: {
          type: true,
          organization: true
        }
      });
    });
  }

  async listSecrets(d: { organization: Organization; type?: SecretType }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.secret.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active',

              type: d.type ? { slug: d.type } : undefined
            },
            include: {
              type: true,
              organization: true
            }
          })
      )
    );
  }

  async DANGEROUSLY_readSecretValue(d: {
    secretId: string | bigint;
    performedBy: OrganizationActor;
    organization: Organization;
    type: SecretType;
    metadata?: Record<string, any>;
  }) {
    let secret = await this.getSecretById({
      secretId: d.secretId,
      organization: d.organization
    });

    await this.ensureSecretActive(secret);

    if (secret.type.slug !== d.type) {
      throw new ServiceError(
        forbiddenError({
          message: `Secret type mismatch.`
        })
      );
    }

    await db.secretEvent.createMany({
      data: {
        id: await ID.generateId('secretEvent'),
        type: 'secret_read',
        secretOid: secret.oid,
        organizationActorOid: d.performedBy.oid,
        metadata: d.metadata ?? {}
      }
    });

    await db.secret.updateMany({
      where: {
        oid: secret.oid
      },
      data: {
        lastUsedAt: new Date()
      }
    });

    let store = SecretStores.get(secret.store.slug);

    let decryptedData = await store.decryptSecret(secret, secret.encryptedData!);

    return {
      secret,
      data: JSON.parse(decryptedData)
    };
  }
}

export let secretService = Service.create('secret', () => new SecretServiceImpl()).build();
