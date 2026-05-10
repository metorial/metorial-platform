import { ID, get4ByteIntId, getId } from '@metorial-subspace/db';
import { indexSkillRecord, reconcileSkillProviderLinks } from '@metorial-subspace/module-skills';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { getVoyagerStubCalls } from '../../test/helpers/voyagerStub';
import { cleanDatabase, testDb } from '../../test/setup';

let createTenantContext = async () => {
  let anonymousClient = createSubspaceControllerRootTestClient();
  let solution = await anonymousClient.solution.upsert({
    name: 'Test Solution',
    identifier: 'test-skill-solution'
  });

  let client = createSubspaceControllerRootTestClient({
    headers: {
      'Subspace-Solution-Id': solution.id
    }
  });

  let tenant = await client.tenant.upsert({
    name: 'Test Tenant',
    identifier: 'test-skill-tenant',
    environments: [
      {
        name: 'Development',
        identifier: 'test-skill-tenant-dev',
        type: 'development'
      }
    ]
  });

  let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
    testDb.tenant.findUniqueOrThrow({ where: { id: tenant.id } }),
    testDb.environment.findUniqueOrThrow({ where: { identifier: 'test-skill-tenant-dev' } }),
    testDb.solution.findUniqueOrThrow({ where: { id: solution.id } })
  ]);

  return {
    client,
    solution,
    tenant,
    tenantRecord,
    environmentRecord,
    solutionRecord
  };
};

let createSkillGroup = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
}) =>
  await testDb.skillGroup.create({
    data: {
      ...getId('skillGroup'),
      slug: 'test-skill-group',
      name: 'Test Skill Group',
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      solutionOid: d.solutionOid
    }
  });

let createIntegration = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
}) =>
  await testDb.integration.create({
    data: {
      ...getId('integration'),
      status: 'active',
      slug: 'test-skill-integration',
      name: 'Test Skill Integration',
      description: 'Integration used by skill tests',
      canAttachCustomToolFilters: true,
      canAttachCustomProviderConfig: false,
      canOverrideToolFilters: false,
      currentVersionIndex: 0,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      solutionOid: d.solutionOid
    }
  });

let createProvider = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
}) => {
  let publisherTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'pub-test-skill-provider'
    }
  });
  let providerTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'pro-test-skill-provider'
    }
  });

  let providerType = await testDb.providerType.create({
    data: {
      oid: get4ByteIntId(),
      id: ID.generateIdSync('providerType'),
      shortKey: 'tsk',
      identifier: 'test-skill-provider-type',
      name: 'Test Skill Provider Type',
      attributes: {
        provider: 'metorial-native',
        backend: 'native',
        triggers: { status: 'disabled' },
        auth: { status: 'disabled' },
        config: { status: 'disabled' }
      }
    }
  });

  let publisher = await testDb.publisher.create({
    data: {
      ...getId('publisher'),
      type: 'tenant',
      identifier: 'test-skill-publisher',
      name: 'Test Skill Publisher',
      description: 'Publisher for skill tests',
      tag: publisherTag.tag,
      tenantOid: d.tenantOid
    }
  });

  let providerEntry = await testDb.providerEntry.create({
    data: {
      ...getId('providerEntry'),
      identifier: 'test-skill-provider-entry',
      name: 'Test Skill Provider Entry',
      description: 'Entry for skill tests',
      publisherOid: publisher.oid
    }
  });

  let provider = await testDb.provider.create({
    data: {
      ...getId('provider'),
      access: 'public',
      status: 'active',
      identifier: 'test-skill-provider',
      slug: 'test-skill-provider',
      name: 'Test Skill Provider',
      description: 'Provider for skill tests',
      tag: providerTag.tag,
      entryOid: providerEntry.oid,
      publisherOid: publisher.oid,
      typeOid: providerType.oid
    }
  });

  await testDb.providerListing.create({
    data: {
      ...getId('providerListing'),
      status: 'active',
      isPublic: true,
      isCustomized: false,
      isMetorial: false,
      isVerified: false,
      isOfficial: false,
      name: 'Test Skill Provider Listing',
      slug: 'test-skill-provider-listing',
      description: 'Listing for skill tests',
      skills: [],
      publisherOid: publisher.oid,
      providerOid: provider.oid,
      typeOid: providerType.oid
    }
  });

  return provider;
};

let createIntegrationProvider = async (d: {
  integrationOid: bigint;
  providerOid: bigint;
  tenantOid: bigint;
  environmentOid: bigint;
  solutionOid: number;
}) =>
  await testDb.integrationProvider.create({
    data: {
      ...getId('integrationProvider'),
      status: 'active',
      name: 'Test Skill Integration Provider',
      description: 'Link between integration and provider',
      toolFilter: { type: 'v1.allow_all' },
      currentVersionIndex: 0,
      integrationOid: d.integrationOid,
      providerOid: d.providerOid,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      solutionOid: d.solutionOid
    }
  });

describe('skill.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, updates, and archives a skill through the controller', async () => {
    let { client, tenant, tenantRecord, environmentRecord, solutionRecord } =
      await createTenantContext();
    let skillGroup = await createSkillGroup({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });

    let created = await client.skill.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillGroupId: skillGroup.id,
      name: 'Draft Skill',
      description: 'Initial description'
    });

    expect(created.name).toBe('Draft Skill');
    expect(created.skillGroupId).toBe(skillGroup.id);
    expect(created.integrations).toEqual([]);
    expect(created.providers).toEqual([]);

    let updated = await client.skill.update({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: created.id,
      name: 'Updated Skill',
      description: 'Updated description'
    });

    expect(updated.name).toBe('Updated Skill');
    expect(updated.description).toBe('Updated description');

    let archived = await client.skill.delete({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: created.id
    });

    expect(archived.status).toBe('archived');

    let skillRecord = await testDb.skill.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(skillRecord.status).toBe('archived');
  });

  it('resurrects an archived integration skill item when it is added again', async () => {
    let { client, tenant, tenantRecord, environmentRecord, solutionRecord } =
      await createTenantContext();
    let skillGroup = await createSkillGroup({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });
    let integration = await createIntegration({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });

    let skill = await client.skill.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillGroupId: skillGroup.id,
      name: 'Resurrection Skill'
    });

    let created = await client.skillItem.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: skill.id,
      type: 'integration',
      integrationId: integration.id
    });

    expect(created.type).toBe('integration');
    expect(created.integration?.id).toBe(integration.id);

    let archived = await client.skillItem.delete({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillItemId: created.id
    });

    expect(archived.status).toBe('archived');

    let resurrected = await client.skillItem.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: skill.id,
      type: 'integration',
      integrationId: integration.id
    });

    expect(resurrected.id).toBe(created.id);
    expect(resurrected.status).toBe('active');

    let [skillItemRecord, skillIntegrationRecord] = await Promise.all([
      testDb.skillItem.findUniqueOrThrow({ where: { id: created.id } }),
      testDb.skillIntegration.findFirstOrThrow({
        where: {
          skill: { id: skill.id },
          integration: { id: integration.id }
        }
      })
    ]);

    expect(skillItemRecord.status).toBe('active');
    expect(skillIntegrationRecord.status).toBe('active');
  });

  it('forks a skill through the controller without exposing parentSkillId in the write api', async () => {
    let { client, tenant, tenantRecord, environmentRecord, solutionRecord } =
      await createTenantContext();
    let skillGroup = await createSkillGroup({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });

    let original = await client.skill.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillGroupId: skillGroup.id,
      name: 'Original Skill'
    });

    let fork = await client.skill.fork({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: original.id,
      name: 'Forked Skill'
    });

    expect(fork.name).toBe('Forked Skill');
    expect(fork.forkedFromId).toBe(original.id);

    let forkRecord = await testDb.skill.findUniqueOrThrow({
      where: { id: fork.id },
      include: { forkedFrom: true }
    });

    expect(forkRecord.parentSkillOid).toBeTruthy();
    expect(forkRecord.forkedFrom?.parentSkillOid).toBeTruthy();
  });

  it('reconciles provider links and indexes integrations/providers into the skill document', async () => {
    let { client, tenant, tenantRecord, environmentRecord, solutionRecord } =
      await createTenantContext();
    let skillGroup = await createSkillGroup({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });
    let integration = await createIntegration({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });
    let provider = await createProvider({
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });
    await createIntegrationProvider({
      integrationOid: integration.oid,
      providerOid: provider.oid,
      tenantOid: tenantRecord.oid,
      environmentOid: environmentRecord.oid,
      solutionOid: solutionRecord.oid
    });

    let skill = await client.skill.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillGroupId: skillGroup.id,
      name: 'Indexed Skill'
    });

    await client.skillItem.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      skillId: skill.id,
      type: 'integration',
      integrationId: integration.id
    });

    await reconcileSkillProviderLinks({ skillId: skill.id });

    let links = await testDb.skillProviderLink.findMany({
      where: { skill: { id: skill.id } },
      include: { provider: true }
    });

    expect(links).toHaveLength(1);
    expect(links[0]?.provider.id).toBe(provider.id);

    await indexSkillRecord({ skillId: skill.id });

    let indexCalls = getVoyagerStubCalls('record:index');
    let latestIndexCall = indexCalls[indexCalls.length - 1];

    expect(latestIndexCall?.payload.documentId).toBe(skill.id);
    expect(latestIndexCall?.payload.body.integrationNames).toContain(integration.name);
    expect(latestIndexCall?.payload.body.providerNames).toContain(provider.name);
  });
});
