import { Encryption } from '@lowerdeck/encryption';
import type { AuditLogStreamProvider, AuditLogStreamProviderData } from '../destinations';
import { validateAuditLogStreamProviderData } from '../destinations';
import { env } from '../env';

let encryption = new Encryption(env.secrets.ENCRYPTION_SECRET);

export let encryptAuditLogStreamProviderData = async <
  Provider extends AuditLogStreamProvider
>(d: {
  streamId: string;
  provider: Provider;
  providerData: Record<string, unknown>;
}) => {
  let providerData = validateAuditLogStreamProviderData(d.provider, d.providerData);
  let encryptedProviderData = await encryption.encrypt({
    entityId: d.streamId,
    secret: JSON.stringify(providerData)
  });

  return { providerData, encryptedProviderData };
};

export let decryptAuditLogStreamProviderData = async <
  Provider extends AuditLogStreamProvider
>(d: {
  streamId: string;
  provider: Provider;
  encryptedProviderData: string;
}): Promise<AuditLogStreamProviderData[Provider]> =>
  JSON.parse(
    await encryption.decrypt({
      entityId: d.streamId,
      encrypted: d.encryptedProviderData
    })
  );
