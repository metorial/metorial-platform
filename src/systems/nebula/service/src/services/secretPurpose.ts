import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { SecretPurpose } from '../../prisma/generated/client';
import { db } from '../db';
import { get4ByteIntId } from '../id';
import { secretPurposeCache } from '../lib/secretPurposeCache';

export let knownSecretPurposeIdentifiers = [
  'registry_credentials',
  'server_config_value',
  'oauth_connection_credentials',
  'oauth_token',
  'slate_authentication_configuration',
  'slate_oauth_credentials',
  'slate_oauth_setup'
] as const;

class SecretPurposeServiceImpl {
  async ensurePurpose(identifier: string): Promise<SecretPurpose> {
    let cached = await secretPurposeCache.getByIdentifierOrLoad(identifier);
    if (cached) return cached;

    let purpose = await db.secretPurpose.upsert({
      where: { identifier },
      update: {},
      create: {
        oid: get4ByteIntId(),
        identifier
      }
    });

    secretPurposeCache.set(purpose);
    return purpose;
  }

  async getPurposeIdentifier(secret: {
    purposeOid: number | null;
    purposeLegacy: string | null;
  }) {
    if (secret.purposeOid != null) {
      let purpose = await secretPurposeCache.getByOidOrLoad(secret.purposeOid);
      if (purpose) return purpose.identifier;
    }

    if (secret.purposeLegacy) return secret.purposeLegacy;

    throw new ServiceError(badRequestError({ message: 'Secret purpose is missing' }));
  }

  async warmKnownPurposes() {
    await Promise.all(
      knownSecretPurposeIdentifiers.map(identifier => this.ensurePurpose(identifier))
    );
  }
}

export let secretPurposeService = Service.create(
  'secretPurposeService',
  () => new SecretPurposeServiceImpl()
).build();
