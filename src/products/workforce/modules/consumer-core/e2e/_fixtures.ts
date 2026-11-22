import {
  ID,
  type ConsumerProfile,
  type ConsumerSurface,
  type ConsumerSurfaceType,
  type User
} from '@metorial/db';
import { bootstrapUser, testContext, uniqueEmail, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  machineAccessAuthService,
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { consumerGroupService, consumerProfileService, consumerSurfaceService } from '../src';

export let createConsumerSurface = async (
  fixture: OrganizationFixture,
  input: {
    name?: string;
    type?: ConsumerSurfaceType;
    emailWhitelist?: string[];
    sessionExpiryTimeInSeconds?: number;
  } = {}
) =>
  await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: input.type ?? 'portal',
    input: {
      name: input.name ?? uniqueId('Surface'),
      sessionExpiryTimeInSeconds: input.sessionExpiryTimeInSeconds ?? 3600,
      emailWhitelist: input.emailWhitelist
    }
  });

export let createPortalSurface = async (
  fixture: OrganizationFixture,
  name = uniqueId('Portal')
) => {
  let surface = await createConsumerSurface(fixture, { name });

  let portal = await db.portal.create({
    data: {
      id: await ID.generateId('portal'),
      status: 'active',
      name,
      slug: uniqueId('e2e-portal').toLowerCase(),
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      surfaceOid: surface.oid
    }
  });

  return { surface, portal };
};

export let createConsumerProfile = async (
  fixture: OrganizationFixture,
  surface: ConsumerSurface,
  input: { email?: string; name?: string } = {}
) =>
  await consumerProfileService.createConsumerProfile({
    surface,
    email: input.email ?? uniqueEmail('profile'),
    name: input.name ?? 'E2E Profile',
    auditScope: fixture.auditScope
  });

export let createConsumerGroup = async (
  fixture: OrganizationFixture,
  surface: ConsumerSurface,
  input: { name?: string; ssoGroupIds?: string[]; isDefault?: boolean } = {}
) =>
  await consumerGroupService.createConsumerGroup({
    consumerSurface: surface,
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('Group'),
      ssoGroupIds: input.ssoGroupIds,
      isDefault: input.isDefault
    }
  });

export let createAccessListing = async (surface: ConsumerSurface) =>
  await db.consumerAccessListing.create({
    data: {
      id: await ID.generateId('consumerAccess'),
      name: uniqueId('Listing'),
      surfaceOid: surface.oid
    }
  });

export let signUpUser = async (email = uniqueEmail('consumer-user')) => {
  let user = await bootstrapUser({ email });
  return await db.user.findUniqueOrThrow({ where: { id: user.id } });
};

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};

export let relayEmailsTo = async (email: string) => {
  let url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/relay';

  let sql = new Bun.SQL(url.toString());
  try {
    return (await sql`
      SELECT e.subject
      FROM "OutgoingEmail" e
      JOIN "OutgoingEmailDestination" d ON d."emailId" = e.oid
      WHERE d.destination = ${email}
    `) as { subject: string }[];
  } finally {
    await sql.close();
  }
};

export let createDesktopUser = async (fixture: OrganizationFixture) => {
  let email = uniqueEmail('desktop');
  let user = await signUpUser(email);
  let { surface } = await createPortalSurface(fixture);
  let consumerProfile = await createConsumerProfile(fixture, surface, { email });
  await db.consumer.update({
    where: { oid: consumerProfile.consumerOid },
    data: { userOid: user.oid }
  });

  return { user, consumerProfile };
};

export let signInDesktop = async (
  fixture: OrganizationFixture,
  d: { user: User; consumerProfile: ConsumerProfile }
) => {
  if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
    await oauthApplicationService.upsertCliAuthOAuthApplication();
  }

  let request = await oauthAuthorizationService.createCliAuthAuthorizationRequest({
    context: testContext(),
    subjectType: 'consumer'
  });
  await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
    oauthAuthorizationRequest: request,
    user: d.user,
    organizationId: fixture.organization.id,
    consumerProfileId: d.consumerProfile.id,
    context: testContext()
  });
  let exchanged = await oauthAuthorizationService.exchangeCliAuthToken({
    token: request.deviceCode!
  });

  return await authenticate(exchanged.oauthToken.accessToken);
};

export let authenticate = async (accessToken: string) => {
  let auth = await machineAccessAuthService.authenticateWithMachineAccessToken({
    token: accessToken,
    context: testContext()
  });
  if (auth.type != 'oauth_token') throw new Error('Expected an OAuth token');

  return auth.oauthToken;
};
