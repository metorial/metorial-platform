import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, type ProviderAuthConfig } from '@metorial-subspace/db';

export let checkManagedCredentialsBlocked = async (authConfig: ProviderAuthConfig) => {
  if (!authConfig.authCredentialsOid) return;

  let authCredentials = await db.providerAuthCredentials.findUnique({
    where: { oid: authConfig.authCredentialsOid },
    select: {
      origin: true
    }
  });

  if (!authCredentials || authCredentials.origin === 'tenant_created')
    return;

  throw new ServiceError(
    badRequestError({
      message: 'Import and export are not allowed for auth configs linked to managed credentials',
      code: 'managed_credentials_import_export_blocked'
    })
  );
};
