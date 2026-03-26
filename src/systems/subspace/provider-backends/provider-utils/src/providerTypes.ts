import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { generatePlainId } from '@lowerdeck/id';
import { db, get4ByteIntId, ID } from '@metorial-subspace/db';

export let ensureProviderType = async (
  name: string,
  attributes: PrismaJson.ProviderTypeAttributes
) => {
  let identifier = `provider::type::${await Hash.sha256(canonicalize({ attributes }))}`;

  return await db.providerType.upsert({
    where: { identifier },
    update: { name, attributes },
    create: {
      oid: get4ByteIntId(),
      id: await ID.generateId('providerType'),
      identifier,
      name,
      attributes,
      shortKey: generatePlainId(3).toLowerCase()
    }
  });
};
