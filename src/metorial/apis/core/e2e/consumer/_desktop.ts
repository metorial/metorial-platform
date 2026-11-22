import {
  API_VERSIONS,
  bootstrapUser,
  metorialEndpoints,
  rest,
  testContext,
  uniqueEmail,
  uniqueId,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import {
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { createConsumerProfile } from './_shared';

export let clients = [
  { key: 'cursor', name: 'Cursor', detected: true, installable: true, supports_skills: true },
  { key: 'vscode', name: 'VS Code', detected: true, installable: true, supports_skills: false }
];

export let checkInBody = (overrides: Record<string, unknown> = {}) => ({
  installation_id: uniqueId('installation-0123456789'),
  name: 'E2E MacBook',
  os: 'macos',
  arch: 'aarch64',
  app_version: '0.2.0',
  clients,
  ...overrides
});

export let signInDesktop = async (org: BootstrappedOrganization, portalId: string) => {
  let email = uniqueEmail('desktop');
  let user = await db.user.findUniqueOrThrow({
    where: { id: (await bootstrapUser({ email })).id }
  });
  let profile = await createConsumerProfile(org, portalId, { email });
  let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
    where: { id: profile.id }
  });
  await db.consumer.update({
    where: { oid: consumerProfile.consumerOid },
    data: { userOid: user.oid }
  });

  if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
    await oauthApplicationService.upsertCliAuthOAuthApplication();
  }

  let request = await oauthAuthorizationService.createCliAuthAuthorizationRequest({
    context: testContext(),
    subjectType: 'consumer'
  });
  await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
    oauthAuthorizationRequest: request,
    user,
    organizationId: org.ids.organizationId,
    consumerProfileId: profile.id,
    context: testContext()
  });
  let exchanged = await oauthAuthorizationService.exchangeCliAuthToken({
    token: request.deviceCode!
  });

  return {
    profile,
    oauthToken: exchanged.oauthToken,
    client: rest(metorialEndpoints().api, {
      apiKey: exchanged.oauthToken.accessToken,
      version: API_VERSIONS.magnetar
    })
  };
};
