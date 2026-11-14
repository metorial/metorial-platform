import { Service } from '@lowerdeck/service';
import { createSystemAuditScope } from '@metorial/audit-scope';
import {
  db,
  ID,
  Organization,
  Outpost,
  OutpostTokenKeyPair,
  withTransaction,
  type TransactionDB
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import { base64url, Ed25519 } from '@metorial-outpost/crypto';
import { OutpostTokens } from '@metorial-outpost/tokens';
import { OUTPOST_KEY_SIGNING_WINDOW_MS, OUTPOST_KEY_VERIFY_GRACE_MS } from '../lib/constants';
import { outpostKeyEncryption } from '../lib/encryption';

let signingKeyPairLock = createLock({ name: 'outpost/tokenKeyPair' });

class OutpostTokenKeyPairService {
  async demoteElapsedKeyPairs(d: {
    where?: { accountOid?: bigint; organizationOid?: bigint };
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    let scope = {
      ...(d.where?.accountOid == null ? {} : { accountOid: d.where.accountOid }),
      ...(d.where?.organizationOid == null ? {} : { organizationOid: d.where.organizationOid })
    };

    let toReplace = await db.outpostTokenKeyPair.findMany({
      where: { ...scope, status: 'active', stopSigningAt: { lte: now } },
      include: { organization: true }
    });

    let toExpire = await db.outpostTokenKeyPair.findMany({
      where: {
        ...scope,
        status: { in: ['active', 'replaced'] },
        stopVerifyingAt: { lte: now }
      },
      include: { organization: true }
    });

    if (toReplace.length > 0) {
      await db.outpostTokenKeyPair.updateMany({
        where: { oid: { in: toReplace.map(keyPair => keyPair.oid) } },
        data: { status: 'replaced' }
      });

      for (let previousKeyPair of toReplace) {
        if (toExpire.some(expired => expired.oid == previousKeyPair.oid)) continue;

        await Fabric.fire('outpost_token_key_pair.replaced:after', {
          keyPair: { ...previousKeyPair, status: 'replaced' },
          previousKeyPair,
          organization: previousKeyPair.organization,
          auditScope: this.auditScope(previousKeyPair.organization)
        });
      }
    }

    if (toExpire.length > 0) {
      await db.outpostTokenKeyPair.updateMany({
        where: { oid: { in: toExpire.map(keyPair => keyPair.oid) } },
        data: { status: 'expired' }
      });

      for (let previousKeyPair of toExpire) {
        await Fabric.fire('outpost_token_key_pair.expired:after', {
          keyPair: { ...previousKeyPair, status: 'expired' },
          previousKeyPair,
          organization: previousKeyPair.organization,
          auditScope: this.auditScope(previousKeyPair.organization)
        });
      }
    }

    return { replaced: toReplace.length, expired: toExpire.length };
  }

  async getSigningKeyPair(d: { outpost: Outpost }): Promise<OutpostTokenKeyPair> {
    let now = new Date();

    let existing = await this.findSigningKeyPair({
      accountOid: d.outpost.accountOid,
      organizationOid: d.outpost.organizationOid,
      now
    });
    if (existing) return existing;

    await this.demoteElapsedKeyPairs({
      where: {
        accountOid: d.outpost.accountOid,
        organizationOid: d.outpost.organizationOid
      },
      now
    });

    return await signingKeyPairLock.usingLock(
      `${d.outpost.accountOid}-${d.outpost.organizationOid}`,
      async () =>
        await withTransaction(async tdb => {
          // Another registration may have created one while we waited for the lock.
          let raced = await this.findSigningKeyPair(
            {
              accountOid: d.outpost.accountOid,
              organizationOid: d.outpost.organizationOid,
              now
            },
            tdb
          );
          if (raced) return raced;

          return await this.createKeyPair(
            {
              accountOid: d.outpost.accountOid,
              organizationOid: d.outpost.organizationOid,
              now
            },
            tdb
          );
        })
    );
  }

  async getSigningTokens(d: { outpost: Outpost }): Promise<OutpostTokens> {
    let keyPair = await this.getSigningKeyPair(d);
    let privateKeyBytes = await this.decryptPrivateKey(keyPair);

    return new OutpostTokens({
      signing: {
        kid: keyPair.id,
        privateKey: () => Ed25519.importPrivateKey(privateKeyBytes),
        publicKey: () => Ed25519.importPublicKey(new Uint8Array(keyPair.publicKey))
      }
    });
  }

  async getVerificationPublicKey(d: { kid: string }): Promise<string | undefined> {
    let keyPair = await db.outpostTokenKeyPair.findUnique({ where: { id: d.kid } });
    if (!keyPair) return undefined;
    if (keyPair.status == 'revoked' || keyPair.status == 'expired') return undefined;
    if (keyPair.stopVerifyingAt.getTime() < Date.now()) return undefined;

    return base64url.encode(new Uint8Array(keyPair.publicKey));
  }

  async revokeKeyPair(d: { keyPair: OutpostTokenKeyPair; organization: Organization }) {
    return await withTransaction(async tdb => {
      let keyPair = await tdb.outpostTokenKeyPair.update({
        where: { oid: d.keyPair.oid },
        data: { status: 'revoked' }
      });

      await Fabric.fire('outpost_token_key_pair.expired:after', {
        keyPair,
        previousKeyPair: d.keyPair,
        organization: d.organization,
        auditScope: this.auditScope(d.organization)
      });

      return keyPair;
    });
  }

  private auditScope(organization: Organization) {
    return createSystemAuditScope({
      organization,
      job: 'outpost_token_key_pair',
      context: { ip: '0.0.0.0', ua: 'Metorial System' }
    });
  }

  private async findSigningKeyPair(
    d: { accountOid: bigint; organizationOid: bigint; now: Date },
    tdb: TransactionDB = db
  ) {
    return await tdb.outpostTokenKeyPair.findFirst({
      where: {
        accountOid: d.accountOid,
        organizationOid: d.organizationOid,
        status: 'active',
        stopSigningAt: { gt: d.now }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async createKeyPair(
    d: { accountOid: bigint; organizationOid: bigint; now: Date },
    tdb: TransactionDB = db
  ) {
    let id = await ID.generateId('outpostTokenKeyPair');

    let generated = await Ed25519.generateKeyPair();
    let publicKeyBytes = await Ed25519.exportPublicKey(generated.publicKey);
    let privateKeyBytes = await Ed25519.exportPrivateKey(generated.privateKey);

    let privateKeyEncrypted = await outpostKeyEncryption.encryptToBytes({
      secret: base64url.encode(privateKeyBytes),
      entityId: id
    });

    let stopSigningAt = new Date(d.now.getTime() + OUTPOST_KEY_SIGNING_WINDOW_MS);
    let stopVerifyingAt = new Date(stopSigningAt.getTime() + OUTPOST_KEY_VERIFY_GRACE_MS);

    let keyPair = await tdb.outpostTokenKeyPair.create({
      data: {
        id,
        status: 'active',
        accountOid: d.accountOid,
        organizationOid: d.organizationOid,
        publicKey: Buffer.from(publicKeyBytes),
        privateKeyEncrypted: Buffer.from(privateKeyEncrypted),
        stopSigningAt,
        stopVerifyingAt
      },
      include: { organization: true }
    });

    await Fabric.fire('outpost_token_key_pair.created:after', {
      keyPair,
      organization: keyPair.organization,
      auditScope: this.auditScope(keyPair.organization)
    });

    return keyPair;
  }

  private async decryptPrivateKey(keyPair: OutpostTokenKeyPair) {
    let encoded = await outpostKeyEncryption.decryptFromBytes({
      encrypted: new Uint8Array(keyPair.privateKeyEncrypted),
      entityId: keyPair.id
    });

    return base64url.decode(encoded);
  }
}

export let outpostTokenKeyPairService = Service.create(
  'outpostTokenKeyPairService',
  () => new OutpostTokenKeyPairService()
).build();
