import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getEncryption } from '../encryption';
import { getId } from '../id';
import {
  generateSigningKeyPair,
  signSlatePackManifest,
  signSlateVersion,
  type SigningPrivateKey
} from '../lib/signature';
import { isSigningEnabled } from '../mode';

let privateKeyCache = new Map<string, SigningPrivateKey>();

export let getSigningKeyPeriod = (date: Date) =>
  `${date.getUTCFullYear()}-H${date.getUTCMonth() < 6 ? 1 : 2}`;

type SignableSlateVersion = {
  oid: bigint;
  version: string;
  slate: { fullIdentifier: string };
  bundleArtifact: { checksum: string };
};

class signingKeyServiceImpl {
  // Replicas race on boot and on the cron; the unique period makes exactly one insert win.
  async ensureCurrentSigningKey() {
    if (!isSigningEnabled()) return { created: false };

    let period = getSigningKeyPeriod(new Date());

    let existing = await db.registrySigningKey.findUnique({ where: { period } });
    if (existing) return { created: false };

    let pair = await generateSigningKeyPair();
    let ids = getId('registrySigningKey');
    let encryptedPrivateKey = await getEncryption().encrypt({
      secret: JSON.stringify(pair.privateKey),
      entityId: pair.kid
    });

    let result = await db.registrySigningKey.createMany({
      skipDuplicates: true,
      data: [
        {
          ...ids,
          status: 'active',
          kid: pair.kid,
          period,
          publicKey: pair.publicKey,
          encryptedPrivateKey
        }
      ]
    });

    return { created: result.count > 0 };
  }

  async listActiveSigningKeys() {
    return db.registrySigningKey.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getKeyring() {
    let keys = await db.registrySigningKey.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return keys.map(key => ({
      kid: key.kid,
      status: key.status,
      publicKey: key.publicKey,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt
    }));
  }

  async signSlateVersions(d: { versions: SignableSlateVersion[] }) {
    if (!isSigningEnabled()) return { signed: 0 };

    let keys = await this.listActiveSigningKeys();
    let versions = d.versions.filter(version => version.bundleArtifact.checksum);
    if (!keys.length || !versions.length) return { signed: 0 };

    let existing = await db.slateVersionSignature.findMany({
      where: { slateVersionOid: { in: versions.map(version => version.oid) } },
      select: { slateVersionOid: true, kid: true }
    });
    let existingSet = new Set(existing.map(sig => `${sig.slateVersionOid}:${sig.kid}`));

    let data: {
      oid: bigint;
      id: string;
      kid: string;
      signature: string;
      slateVersionOid: bigint;
    }[] = [];

    for (let key of keys) {
      let privateKey = await this.getPrivateKey(key);

      for (let version of versions) {
        if (existingSet.has(`${version.oid}:${key.kid}`)) continue;

        let signature = await signSlateVersion({
          privateKey,
          statement: {
            identifier: version.slate.fullIdentifier,
            version: version.version,
            contentChecksum: version.bundleArtifact.checksum
          }
        });

        data.push({
          ...getId('slateVersionSignature'),
          kid: key.kid,
          signature,
          slateVersionOid: version.oid
        });
      }
    }

    if (!data.length) return { signed: 0 };

    let result = await db.slateVersionSignature.createMany({ data, skipDuplicates: true });
    return { signed: result.count };
  }

  async signSlatePackManifest(d: { manifest: Uint8Array }) {
    if (!isSigningEnabled()) return [];

    let keys = await this.listActiveSigningKeys();
    let signatures: { kid: string; signature: string }[] = [];

    for (let key of keys) {
      let privateKey = await this.getPrivateKey(key);
      let signature = await signSlatePackManifest({ privateKey, manifest: d.manifest });

      signatures.push({ kid: key.kid, signature });
    }

    return signatures;
  }

  async trySignSlateVersion(d: { version: SignableSlateVersion }) {
    try {
      await this.signSlateVersions({ versions: [d.version] });
    } catch (error) {
      // The backfill cron signs anything missed here.
      console.error('[Registry]: Failed to sign slate version on publish', error);
    }
  }

  private async getPrivateKey(key: { kid: string; encryptedPrivateKey: string }) {
    let cached = privateKeyCache.get(key.kid);
    if (cached) return cached;

    let decrypted = await getEncryption().decrypt({
      encrypted: key.encryptedPrivateKey,
      entityId: key.kid
    });
    let privateKey = JSON.parse(decrypted) as SigningPrivateKey;

    privateKeyCache.set(key.kid, privateKey);
    return privateKey;
  }
}

export let signingKeyService = Service.create(
  'signingKeyService',
  () => new signingKeyServiceImpl()
).build();
