import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { generatePlainId } from '@lowerdeck/id';
import { db, get4ByteIntId, ID } from '@metorial-subspace/db';

export let ensureProviderType = async (
  name: string,
  attributes: PrismaJson.ProviderTypeAttributes
) => {
  let identifier = `provider::type::${await Hash.sha256(canonicalize({ attributes }))}`;

  let inner = {
    identifier,
    name,
    attributes,

    supportsConfig: attributes.config.status == 'enabled',
    supportsAuth: attributes.auth.status == 'enabled',
    supportsOAuth:
      attributes.auth.status == 'enabled' && attributes.auth.oauth.status == 'enabled',
    supportsOAuthAutoRegistration:
      attributes.auth.status == 'enabled' &&
      attributes.auth.oauth.status == 'enabled' &&
      attributes.auth.oauth.oauthAutoRegistration?.status == 'supported',
    supportsCallbacks: attributes.triggers.status == 'enabled',
    supportsAuthExport:
      attributes.auth.status == 'enabled' && attributes.auth.export.status == 'enabled',
    supportsAuthImport:
      attributes.auth.status == 'enabled' && attributes.auth.import.status == 'enabled'
  };

  return await db.providerType.upsert({
    where: { identifier },
    update: inner,
    create: {
      oid: get4ByteIntId(),
      id: await ID.generateId('providerType'),
      shortKey: generatePlainId(3).toLowerCase(),

      ...inner
    }
  });
};
