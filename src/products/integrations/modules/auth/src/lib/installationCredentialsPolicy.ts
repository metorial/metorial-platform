import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { db, type Provider, type Tenant } from '@metorial-subspace/db';
import { checkEdition } from '@metorial/editions';
import { defineSettings, setting } from '@metorial/settings';

let policy = defineSettings('integrationsAuth', {
  allowProjectCredentials: setting(v.boolean(), {
    env: 'INTEGRATIONS_ALLOW_PROJECT_AUTH_CREDENTIALS',
    editions: ['on-prem'],
    default: true,
    description:
      'Whether projects may add their own OAuth credentials for providers that have credentials managed centrally by enterprise admins'
  })
});

export let areProjectCredentialsAllowed = () =>
  checkEdition('cloud') || policy.allowProjectCredentials !== false;

export let assertProjectCredentialsAllowed = async (d: {
  tenant: Tenant;
  provider: Provider;
}) => {
  if (areProjectCredentialsAllowed()) return;

  let installationCredentials = await db.providerAuthCredentials.findFirst({
    where: {
      tenantOid: d.tenant.oid,
      providerOid: d.provider.oid,
      origin: 'installation_template',
      status: 'active'
    },
    select: { oid: true }
  });
  if (!installationCredentials) return;

  throw new ServiceError(
    badRequestError({
      message:
        'OAuth credentials for this provider are managed by your enterprise administrator.',
      code: 'project_auth_credentials_not_allowed'
    })
  );
};
