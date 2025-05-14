import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Secret,
  SecretStatus,
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
    instance: Instance;
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
      instanceOid: d.instance.oid,
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
          instance: true,
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

  async getSecretById(d: { secretId: string | bigint; instance: Instance }) {
    let secret = await db.secret.findFirst({
      where: {
        id: typeof d.secretId === 'string' ? d.secretId : undefined,
        oid: typeof d.secretId === 'bigint' ? d.secretId : undefined,

        instanceOid: d.instance.oid
      },
      include: {
        type: true,
        store: true,
        instance: true,
        organization: true
      }
    });

    if (!secret) throw new ServiceError(notFoundError('secret', d.secretId.toString()));

    return secret;
  }

  async deleteSecret(d: { secret: Secret; performedBy: OrganizationActor }) {
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
          instance: true,
          organization: true
        }
      });
    });
  }

  async listSecrets(d: { instance: Instance; type?: SecretType[]; status?: SecretStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.secret.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              status: d.status ? { in: d.status } : undefined,
              type: d.type ? { slug: { in: d.type } } : undefined
            },
            include: {
              type: true,
              instance: true,
              organization: true
            }
          })
      )
    );
  }

  async DANGEROUSLY_readSecretValue(d: {
    secretId: string | bigint;
    performedBy: OrganizationActor;
    instance: Instance;
    type: SecretType;
    metadata?: Record<string, any>;
  }) {
    let secret = await this.getSecretById({
      secretId: d.secretId,
      instance: d.instance
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
