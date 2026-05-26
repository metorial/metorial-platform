import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Consumer, Secret, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import {
  canonicalJson,
  constantTimeEqual,
  decryptAes256Gcm,
  encryptAes256Gcm,
  sha512Hex
} from '../lib/crypto';
import { keyProviderService } from './keyProvider';
import { keyService } from './key';
import { secretUseService } from './secretUse';

let genericUseError = () =>
  new ServiceError(badRequestError({ message: 'Unable to use secret' }));

let assertBoundedJson = (name: string, value: any) => {
  let json = canonicalJson(value);
  if (json.length > 16_384) {
    throw new ServiceError(badRequestError({ message: `${name} is too large` }));
  }
  return json;
};

let getProofHash = (tenant: Tenant, proof: any) =>
  sha512Hex(`${tenant.id}::${assertBoundedJson('proof', proof)}`);

let validateSecretUseNote = (note: string) => {
  if (!note || note.trim().length === 0 || note.length > 1024) {
    throw genericUseError();
  }

  return note;
};

let getAad = (d: {
  tenant: Tenant;
  consumerId: string;
  secretId: string;
  versionId: string;
  purpose: string;
  keyId: string;
  keyProviderId: string;
  encryptionContext: any;
}) =>
  Buffer.from(
    canonicalJson({
      tenantId: d.tenant.id,
      consumerId: d.consumerId,
      secretId: d.secretId,
      versionId: d.versionId,
      purpose: d.purpose,
      keyId: d.keyId,
      keyProviderId: d.keyProviderId,
      encryptionContext: d.encryptionContext
    }),
    'utf8'
  );

let include = {
  consumer: true,
  currentVersion: {
    include: {
      key: { include: { keyProvider: true } },
      keyProvider: true
    }
  }
};

class SecretServiceImpl {
  async createSecret(d: {
    tenant: Tenant;
    consumer: Consumer;
    input: {
      purpose: string;
      secret: string;
      proof: any;
      encryptionContext?: any;
      keyProviderId?: string | null;
    };
  }) {
    this.validateSecretInput(d.input);

    let keyProvider = await keyProviderService.resolveForTenant({
      tenant: d.tenant,
      keyProviderId: d.input.keyProviderId
    });
    let key = await keyService.getCurrentKeyForEncryption({ tenant: d.tenant, keyProvider });
    let plaintextDataKey = await keyService.getPlaintextDataKey({
      tenant: d.tenant,
      key: { ...key, keyProvider }
    });

    let secretId = await ID.generateId('secret');
    let versionId = await ID.generateId('secretVersion');
    let encryptionContext = d.input.encryptionContext ?? {};
    assertBoundedJson('encryptionContext', encryptionContext);

    let aad = getAad({
      tenant: d.tenant,
      consumerId: d.consumer.id,
      secretId,
      versionId,
      purpose: d.input.purpose,
      keyId: key.id,
      keyProviderId: keyProvider.id,
      encryptionContext
    });

    let encrypted = encryptAes256Gcm({
      key: plaintextDataKey,
      plaintext: Buffer.from(d.input.secret, 'utf8'),
      aad
    });

    return await db.$transaction(async tx => {
      let secret = await tx.secret.create({
        data: {
          oid: snowflake.nextId(),
          id: secretId,
          tenantOid: d.tenant.oid,
          consumerOid: d.consumer.oid,
          purpose: d.input.purpose,
          status: 'active'
        }
      });

      let version = await tx.secretVersion.create({
        data: {
          oid: snowflake.nextId(),
          id: versionId,
          tenantOid: d.tenant.oid,
          secretOid: secret.oid,
          keyOid: key.oid,
          keyProviderOid: keyProvider.oid,
          proofHash: getProofHash(d.tenant, d.input.proof),
          encryptionContext,
          alg: 'aes_256_gcm',
          iv: new Uint8Array(encrypted.iv),
          ciphertext: new Uint8Array(encrypted.ciphertext),
          authTag: new Uint8Array(encrypted.authTag),
          aadHash: sha512Hex(aad)
        }
      });

      return await tx.secret.update({
        where: { oid: secret.oid },
        data: { currentVersionOid: version.oid },
        include
      });
    });
  }

  async updateSecret(d: {
    tenant: Tenant;
    consumer: Consumer;
    secret: Secret;
    input: {
      secret: string;
      proof: any;
      encryptionContext?: any;
      keyProviderId?: string | null;
    };
  }) {
    if (d.secret.consumerOid !== d.consumer.oid) throw genericUseError();

    this.validateSecretInput({
      purpose: d.secret.purpose,
      secret: d.input.secret,
      proof: d.input.proof,
      encryptionContext: d.input.encryptionContext
    });

    let keyProvider = await keyProviderService.resolveForTenant({
      tenant: d.tenant,
      keyProviderId: d.input.keyProviderId
    });
    let key = await keyService.getCurrentKeyForEncryption({ tenant: d.tenant, keyProvider });
    let plaintextDataKey = await keyService.getPlaintextDataKey({
      tenant: d.tenant,
      key: { ...key, keyProvider }
    });

    let versionId = await ID.generateId('secretVersion');
    let encryptionContext = d.input.encryptionContext ?? {};
    let aad = getAad({
      tenant: d.tenant,
      consumerId: d.consumer.id,
      secretId: d.secret.id,
      versionId,
      purpose: d.secret.purpose,
      keyId: key.id,
      keyProviderId: keyProvider.id,
      encryptionContext
    });

    let encrypted = encryptAes256Gcm({
      key: plaintextDataKey,
      plaintext: Buffer.from(d.input.secret, 'utf8'),
      aad
    });

    return await db.$transaction(async tx => {
      let version = await tx.secretVersion.create({
        data: {
          oid: snowflake.nextId(),
          id: versionId,
          tenantOid: d.tenant.oid,
          secretOid: d.secret.oid,
          keyOid: key.oid,
          keyProviderOid: keyProvider.oid,
          proofHash: getProofHash(d.tenant, d.input.proof),
          encryptionContext,
          alg: 'aes_256_gcm',
          iv: new Uint8Array(encrypted.iv),
          ciphertext: new Uint8Array(encrypted.ciphertext),
          authTag: new Uint8Array(encrypted.authTag),
          aadHash: sha512Hex(aad)
        }
      });

      return await tx.secret.update({
        where: { oid: d.secret.oid },
        data: {
          currentVersionOid: version.oid,
          status: 'active'
        },
        include
      });
    });
  }

  async useSecret(d: {
    tenant: Tenant;
    secret: Secret;
    consumer: Consumer;
    proof: any;
    note: string;
  }) {
    try {
      let note = validateSecretUseNote(d.note);

      let secret = await db.secret.findFirst({
        where: {
          oid: d.secret.oid,
          tenantOid: d.tenant.oid,
          consumerOid: d.consumer.oid,
          status: 'active'
        },
        include
      });

      if (!secret?.currentVersion) throw genericUseError();

      let proofHash = getProofHash(d.tenant, d.proof);
      if (!constantTimeEqual(proofHash, secret.currentVersion.proofHash)) {
        throw genericUseError();
      }

      let dataKey = await keyService.getPlaintextDataKey({
        tenant: d.tenant,
        key: secret.currentVersion.key
      });

      let aad = getAad({
        tenant: d.tenant,
        consumerId: d.consumer.id,
        secretId: secret.id,
        versionId: secret.currentVersion.id,
        purpose: secret.purpose,
        keyId: secret.currentVersion.key.id,
        keyProviderId: secret.currentVersion.keyProvider.id,
        encryptionContext: secret.currentVersion.encryptionContext
      });

      let plaintext = decryptAes256Gcm({
        key: dataKey,
        iv: secret.currentVersion.iv,
        ciphertext: secret.currentVersion.ciphertext,
        authTag: secret.currentVersion.authTag,
        aad
      }).toString('utf8');

      await secretUseService.recordSecretUse({
        tenant: d.tenant,
        secret,
        consumer: d.consumer,
        note
      });

      return {
        secret,
        plaintext
      };
    } catch {
      throw genericUseError();
    }
  }

  async getSecretById(d: { tenant: Tenant; id: string }) {
    let secret = await db.secret.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!secret) throw new ServiceError(notFoundError('secret'));
    return secret;
  }

  async listSecrets(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.secret.findMany({
          ...opts,
          where: { tenantOid: d.tenant.oid },
          orderBy: { createdAt: 'desc' },
          include
        })
      )
    );
  }

  async listSecretVersions(d: { tenant: Tenant; secret: Secret }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.secretVersion.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            secretOid: d.secret.oid
          },
          orderBy: { createdAt: 'desc' },
          include: {
            keyProvider: true
          }
        })
      )
    );
  }

  private validateSecretInput(input: {
    purpose: string;
    secret: string;
    proof: any;
    encryptionContext?: any;
  }) {
    if (!input.purpose || input.purpose.length > 256) {
      throw new ServiceError(badRequestError({ message: 'Invalid purpose' }));
    }
    if (!input.secret || Buffer.byteLength(input.secret, 'utf8') > 64 * 1024) {
      throw new ServiceError(badRequestError({ message: 'Invalid secret' }));
    }
    assertBoundedJson('proof', input.proof);
    assertBoundedJson('encryptionContext', input.encryptionContext ?? {});
  }
}

export let secretService = Service.create('secretService', () => new SecretServiceImpl()).build();
