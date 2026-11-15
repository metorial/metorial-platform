import { createHash } from 'crypto';
import type { DataKeyContext } from './adapter';

export let encodeEncryptionContext = (context: DataKeyContext) =>
  Buffer.from(
    JSON.stringify({
      tenantId: context.tenantId,
      tenantOid: String(context.tenantOid),
      keyProviderId: context.keyProviderId,
      keyProviderOid: String(context.keyProviderOid)
    })
  );

export let hashEncryptionContext = (context: DataKeyContext) =>
  createHash('sha256').update(encodeEncryptionContext(context)).digest();
