import {
  createProviderDeployment,
  createRemoteProvider,
  expectOk,
  expectServiceError,
  uniqueId,
  useMcpTestServer,
  useOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerSurface, ProviderTemplate } from '@metorial/db';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  consumerProviderCatalogService,
  consumerProviderDeploymentService,
  consumerProviderSetupSessionService
} from '../src';
import {
  addToGroups,
  consumerView,
  createGroup,
  createPortalSurface,
  createProfile,
  createSurface
} from './_fixtures';

describe('module-consumer-entities provider templates', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  let provider: RemoteProvider;
  let deployment: any;

  beforeAll(async () => {
    provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    deployment = await createProviderDeployment(org.clients.instance, provider.providerId);
  }, 180_000);

  let createTemplate = async () => {
    let client = org.clients.instance;
    let integration = expectOk(
      await client.post('/integrations', { name: uniqueId('e2e-integration') })
    );
    expectOk(
      await client.post('/integration-providers', {
        integration_id: integration.id,
        provider_id: provider.providerId,
        provider_deployment_id: deployment.id
      })
    );
    let template = expectOk(
      await client.post('/provider-templates', {
        name: uniqueId('e2e-template'),
        integration_id: integration.id
      })
    );

    return await db.providerTemplate.findUniqueOrThrow({ where: { id: template.id } });
  };

  let grantTemplate = async (
    fixture: OrganizationFixture,
    consumerSurface: ConsumerSurface,
    consumerGroup: Parameters<
      typeof consumerAccessService.createConsumerAccess
    >[0]['consumerGroup'],
    providerTemplate: ProviderTemplate
  ) =>
    await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface,
      consumerGroup,
      auditScope: fixture.auditScope,
      access: { type: 'provider_template', providerTemplate }
    });

  let startSetup = async (
    fixture: OrganizationFixture,
    consumerSurface: ConsumerSurface,
    consumerProfile: Awaited<ReturnType<typeof createProfile>>,
    providerTemplate: ProviderTemplate
  ) =>
    await consumerProviderSetupSessionService.startSetupSession({
      instance: fixture.instance,
      context: fixture.context,
      auditScope: fixture.auditScope,
      accessTags: (await consumerView(consumerProfile)).accessTags,
      consumerSurface,
      consumerProfile,
      providerTemplateId: providerTemplate.id,
      input: {}
    });

  let deploy = async (
    fixture: OrganizationFixture,
    consumerProfile: Awaited<ReturnType<typeof createProfile>>,
    providerTemplate: ProviderTemplate,
    integrationSetupSessionId: string
  ) =>
    await consumerProviderDeploymentService.deployProvider({
      organization: fixture.organization,
      performedBy: fixture.actor,
      instance: fixture.instance,
      context: fixture.context,
      consumerProfile,
      accessTags: (await consumerView(consumerProfile)).accessTags,
      auditScope: fixture.auditScope,
      providerTemplateId: providerTemplate.id,
      input: { integrationSetupSessionId }
    });

  let countConsumerServers = async (providerTemplate: ProviderTemplate) =>
    await db.magicMcpServer.count({
      where: {
        providerTemplateId: providerTemplate.id,
        source: 'consumer_provider_template',
        status: 'active'
      }
    });

  it('hydrates template entries and exposes capabilities only to consumers with access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let member = await createProfile(fixture, surface);
    let outsider = await createProfile(fixture, surface);
    await addToGroups(fixture, member, [group.id]);
    let template = await createTemplate();
    let access = await grantTemplate(fixture, surface, group, template);

    let entryFor = async (consumerProfile: Awaited<ReturnType<typeof createProfile>>) => {
      let page = await consumerProviderCatalogService.listCatalogEntries({
        instance: fixture.instance,
        consumerSurface: surface,
        consumerProfile,
        ...(await consumerView(consumerProfile)),
        includeCapabilities: true
      });
      expect(page.items).toHaveLength(1);
      let entry = page.items[0]!;
      if (entry.type != 'provider_template') throw new Error(`Unexpected ${entry.type} entry`);
      return entry;
    };

    let memberEntry = await entryFor(member);
    expect(memberEntry).toMatchObject({
      id: access.listing!.id,
      name: template.name,
      availability: 'available_now',
      consumerAccessIds: [access.id],
      providerTemplateId: template.id,
      magicMcpServerId: null
    });
    expect(memberEntry.provider.id).toBe(provider.providerId);
    expect(memberEntry.deployment.id).toBe(deployment.id);
    expect(Array.isArray(memberEntry.authMethods)).toBe(true);

    let outsiderEntry = await entryFor(outsider);
    expect(outsiderEntry).toMatchObject({
      id: access.listing!.id,
      availability: 'request_access',
      consumerAccessIds: [],
      configSchema: null,
      authMethods: []
    });
  });

  it('starts setup sessions only for consumers of a portal with template access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate();

    let portalSurface = await createPortalSurface(fixture);
    let consumer = await createProfile(fixture, portalSurface);
    let outsider = await createProfile(fixture, portalSurface);
    await grantTemplate(fixture, portalSurface, consumer.personalConsumerGroup!, template);

    await expectServiceError(
      startSetup(fixture, portalSurface, outsider, template),
      'forbidden'
    );

    let portallessSurface = await createSurface(fixture);
    let portalless = await createProfile(fixture, portallessSurface);
    await grantTemplate(
      fixture,
      portallessSurface,
      portalless.personalConsumerGroup!,
      template
    );
    await expectServiceError(
      startSetup(fixture, portallessSurface, portalless, template),
      'not_found'
    );

    expect(
      await db.consumerProviderSetupSessionBinding.count({
        where: { consumerProfileOid: { in: [outsider.oid, portalless.oid] } }
      })
    ).toBe(0);

    let setupSession = await startSetup(fixture, portalSurface, consumer, template);
    let binding = await db.consumerProviderSetupSessionBinding.findFirstOrThrow({
      where: { providerSetupSessionId: setupSession.id }
    });
    expect(binding).toMatchObject({
      type: 'integration_setup_session',
      consumerProfileOid: consumer.oid,
      providerTemplateOid: template.oid,
      instanceOid: fixture.instance.oid
    });
  });

  it('only resolves a setup session for the consumer and template it was started for', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate();
    let portalSurface = await createPortalSurface(fixture);
    let consumer = await createProfile(fixture, portalSurface);
    let otherConsumer = await createProfile(fixture, portalSurface);
    await grantTemplate(fixture, portalSurface, consumer.personalConsumerGroup!, template);

    let setupSession = await startSetup(fixture, portalSurface, consumer, template);
    let lookup = (
      consumerProfile: { oid: bigint },
      providerTemplate: { oid: bigint },
      integrationSetupSessionId = setupSession.id
    ) =>
      consumerProviderSetupSessionService.getSetupSession({
        instance: fixture.instance,
        consumerProfile,
        providerTemplate,
        integrationSetupSessionId
      });

    let fetched = await lookup(consumer, template);
    expect(fetched.id).toBe(setupSession.id);
    expect(fetched.status).not.toBe('successful');

    await expectServiceError(lookup(otherConsumer, template), 'unauthorized');
    await expectServiceError(lookup(consumer, { oid: -1n }), 'unauthorized');
    await expectServiceError(lookup(consumer, template, uniqueId('iss')), 'unauthorized');

    await expectServiceError(
      consumerProviderSetupSessionService.getCompletedSetupSession({
        instance: fixture.instance,
        consumerProfile: consumer,
        providerTemplate: template,
        integrationSetupSessionId: setupSession.id
      }),
      'precondition_failed'
    );
  });

  it('refuses to deploy without access, a bound session or a completed setup', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate();
    let portalSurface = await createPortalSurface(fixture);
    let consumer = await createProfile(fixture, portalSurface);
    let otherConsumer = await createProfile(fixture, portalSurface);
    let outsider = await createProfile(fixture, portalSurface);
    for (let consumerProfile of [consumer, otherConsumer]) {
      await grantTemplate(
        fixture,
        portalSurface,
        consumerProfile.personalConsumerGroup!,
        template
      );
    }

    let setupSession = await startSetup(fixture, portalSurface, consumer, template);
    let otherSetupSession = await startSetup(fixture, portalSurface, otherConsumer, template);

    await expectServiceError(
      deploy(fixture, outsider, template, setupSession.id),
      'forbidden'
    );
    await expectServiceError(
      deploy(fixture, consumer, template, otherSetupSession.id),
      'unauthorized'
    );
    await expectServiceError(
      deploy(fixture, consumer, template, setupSession.id),
      'precondition_failed'
    );

    expect(await countConsumerServers(template)).toBe(0);
    expect(
      await db.consumerIntegration.count({
        where: { consumerProfileOid: { in: [consumer.oid, otherConsumer.oid, outsider.oid] } }
      })
    ).toBe(0);
  });
});
