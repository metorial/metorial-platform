import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Organization,
  Outpost,
  OutpostCredential,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { encodeCredentialEnvelope } from '@metorial-outpost/credential-envelope';
import { base64url, Ed25519 } from '@metorial-outpost/crypto';
import { getEnvelopePreview } from '../lib/envelopePreview';

class OutpostCredentialService {
  private ensureCredentialActive(credential: OutpostCredential) {
    if (credential.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a disabled, expired, or deleted credential'
        })
      );
    }
  }

  async createCredential(d: {
    outpost: Outpost;
    organization: Organization;
    input: { name: string; expiresAt?: Date };
    auditScope: AuditScope;
  }) {
    if (d.outpost.status == 'deleted') {
      throw new ServiceError(
        forbiddenError({ message: 'Cannot create credentials for a deleted outpost' })
      );
    }

    let id = await ID.generateId('outpostCredential');

    let keyPair = await Ed25519.generateKeyPair();
    let publicKeyBytes = await Ed25519.exportPublicKey(keyPair.publicKey);
    let privateKeyBytes = await Ed25519.exportPrivateKey(keyPair.privateKey);

    let envelope = encodeCredentialEnvelope({
      version: 1,
      endpoint: `${getConfig().urls.apiUrl}`,
      outpost_id: d.outpost.id,
      credential_id: id,
      private_key: base64url.encode(privateKeyBytes)
    });

    let credential = await withTransaction(async db => {
      await Fabric.fire('outpost_credential.created:before', d);

      let credential = await db.outpostCredential.create({
        data: {
          id,
          status: 'active',
          outpostOid: d.outpost.oid,
          identifier: d.input.name,
          publicKey: Buffer.from(publicKeyBytes),
          envelopePreview: getEnvelopePreview(envelope),
          expiresAt: d.input.expiresAt
        }
      });

      await Fabric.fire('outpost_credential.created:after', { ...d, credential });

      return credential;
    });

    return { credential, envelope };
  }

  async disableCredential(d: {
    credential: OutpostCredential;
    outpost: Outpost;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    this.ensureCredentialActive(d.credential);

    return await withTransaction(async db => {
      await Fabric.fire('outpost_credential.disabled:before', d);

      let credential = await db.outpostCredential.update({
        where: { oid: d.credential.oid },
        data: { status: 'disabled' }
      });

      await Fabric.fire('outpost_credential.disabled:after', {
        ...d,
        credential,
        previousCredential: d.credential
      });

      return credential;
    });
  }

  async deleteCredential(d: {
    credential: OutpostCredential;
    outpost: Outpost;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.credential.status != 'disabled' && d.credential.status != 'expired') {
      throw new ServiceError(
        forbiddenError({
          message: 'Credential must be disabled before it can be deleted'
        })
      );
    }

    return await withTransaction(async db => {
      await Fabric.fire('outpost_credential.deleted:before', d);

      let credential = await db.outpostCredential.update({
        where: { oid: d.credential.oid },
        data: { status: 'deleted' }
      });

      await Fabric.fire('outpost_credential.deleted:after', {
        ...d,
        credential,
        previousCredential: d.credential
      });

      return credential;
    });
  }

  async getCredentialById(d: { outpost: Outpost; credentialId: string }) {
    let credential = await db.outpostCredential.findFirst({
      where: {
        id: d.credentialId,
        outpostOid: d.outpost.oid,
        status: { not: 'deleted' }
      }
    });
    if (!credential)
      throw new ServiceError(notFoundError('outpost_credential', d.credentialId));

    return credential;
  }

  async listCredentials(d: { outpost: Outpost }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.outpostCredential.findMany({
            ...opts,
            where: {
              outpostOid: d.outpost.oid,
              status: { not: 'deleted' }
            },
            orderBy: { createdAt: 'desc' }
          })
      )
    );
  }
}

export let outpostCredentialService = Service.create(
  'outpostCredentialService',
  () => new OutpostCredentialService()
).build();
