import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import {
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import { integrationService } from '@metorial-subspace/module-integration';
import { describe, expect, it } from 'vitest';
import {
  type SkillRecord,
  skillItemService,
  skillResourceService,
  skillService
} from '../src';
import { createSkill, privileged } from './_fixtures';

let createIntegration = async (fixture: OrganizationFixture) =>
  await integrationService.createIntegration({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('skill-integration'), description: 'Attached to skills' }
  });

let attach = async (fixture: OrganizationFixture, skill: SkillRecord, integrationId: string) =>
  await skillItemService.createSkillItem({
    instance: fixture.instance,
    input: { skillId: skill.id, type: 'integration', integrationId }
  });

let listItems = async (
  fixture: OrganizationFixture,
  filters: Omit<Parameters<typeof skillItemService.listSkillItems>[0], 'instance'>
) =>
  await firstPage(
    await skillItemService.listSkillItems({ instance: fixture.instance, ...filters })
  );

describe('module-skill items', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('attaches an integration once and exposes it on the hydrated skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let integration = await createIntegration(fixture);

    let item = await attach(fixture, skill, integration.id);
    expect(item).toMatchObject({
      type: 'integration',
      status: 'active',
      skillId: skill.id,
      integration: { id: integration.id },
      provider: null
    });

    let error = await expectServiceError(
      attach(fixture, skill, integration.id),
      'skill_item_exists'
    );
    expect(error.message).toMatch(/already exists/);

    let subspaceItems = await subspaceDb.skillItem.findMany({
      where: { skill: { id: skill.id } }
    });
    expect(subspaceItems.map(row => row.id)).toEqual([item.id]);

    let fetched = await skillItemService.getSkillItemById({
      instance: fixture.instance,
      skillItemId: item.id
    });
    expect(fetched.integration?.id).toBe(integration.id);

    let hydrated = await skillResourceService.hydrateSkill(skill, {
      instance: fixture.instance
    });
    expect(hydrated.integrations.map(entry => entry.id)).toEqual([integration.id]);

    let byIntegration = await firstPage(
      await skillService.listSkills({
        project: fixture.project,
        instance: fixture.instance,
        integrationIds: [integration.id]
      })
    );
    expect(byIntegration.map(entry => entry.id)).toEqual([skill.id]);
  });

  it('filters items by skill, integration and type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let otherSkill = await createSkill(fixture);
    let first = await createIntegration(fixture);
    let second = await createIntegration(fixture);

    let firstItem = await attach(fixture, skill, first.id);
    let secondItem = await attach(fixture, skill, second.id);
    let otherItem = await attach(fixture, otherSkill, first.id);

    let forSkill = await listItems(fixture, { skillIds: [skill.id] });
    expect(forSkill.map(item => item.id).sort()).toEqual([firstItem.id, secondItem.id].sort());

    let forIntegration = await listItems(fixture, {
      skillIds: [skill.id, otherSkill.id],
      integrationIds: [first.id]
    });
    expect(forIntegration.map(item => item.id).sort()).toEqual(
      [firstItem.id, otherItem.id].sort()
    );

    expect(await listItems(fixture, { skillIds: [skill.id], type: ['provider'] })).toEqual([]);
    expect((await listItems(fixture, { ids: [secondItem.id] })).map(item => item.id)).toEqual([
      secondItem.id
    ]);
  });

  it('archives an item, rejects a second archive and reactivates it on re-attach', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let integration = await createIntegration(fixture);
    let item = await attach(fixture, skill, integration.id);

    let archived = await skillItemService.archiveSkillItem({
      instance: fixture.instance,
      skillItem: item
    });
    expect(archived.status).toBe('archived');

    await expectServiceError(
      skillItemService.archiveSkillItem({ instance: fixture.instance, skillItem: archived }),
      'gone'
    );

    expect(await listItems(fixture, { skillIds: [skill.id] })).toEqual([]);
    expect(
      (await listItems(fixture, { skillIds: [skill.id], status: ['archived'] })).map(
        entry => entry.id
      )
    ).toEqual([item.id]);

    let hydrated = await skillResourceService.hydrateSkill(skill, {
      instance: fixture.instance
    });
    expect(hydrated.integrations).toEqual([]);

    let reattached = await attach(fixture, skill, integration.id);
    expect(reattached).toMatchObject({ id: item.id, status: 'active' });
    expect(await subspaceDb.skillItem.count({ where: { skill: { id: skill.id } } })).toBe(1);
  });

  it('rejects unknown, archived and foreign targets', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let foreignIntegration = await createIntegration(other);
    let foreignSkill = await createSkill(other);
    let integration = await createIntegration(fixture);

    await expectServiceError(attach(fixture, skill, foreignIntegration.id), 'not_found');
    await expectServiceError(attach(fixture, foreignSkill, integration.id), 'not_found');
    await expectServiceError(
      skillItemService.createSkillItem({
        instance: fixture.instance,
        input: {
          skillId: skill.id,
          type: 'provider',
          providerId: uniqueId('missing-provider')
        }
      }),
      'not_found'
    );

    let archivedIntegration = await createIntegration(fixture);
    await integrationService.archiveIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration: archivedIntegration
    });
    await expectServiceError(attach(fixture, skill, archivedIntegration.id), 'not_found');

    expect(await subspaceDb.skillItem.count({ where: { skill: { id: skill.id } } })).toBe(0);
    expect(
      await subspaceDb.skillItem.count({ where: { skill: { id: foreignSkill.id } } })
    ).toBe(0);
  });

  it('hides items from other organizations and from archived skills', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let integration = await createIntegration(fixture);
    let item = await attach(fixture, skill, integration.id);

    await expectServiceError(
      skillItemService.getSkillItemById({ instance: other.instance, skillItemId: item.id }),
      'not_found'
    );
    expect(await listItems(other, { skillIds: [skill.id] })).toEqual([]);
    await expectServiceError(
      skillItemService.archiveSkillItem({ instance: other.instance, skillItem: item }),
      'not_found'
    );
    expect(
      (await subspaceDb.skillItem.findUniqueOrThrow({ where: { id: item.id } })).status
    ).toBe('active');

    let archivedSkill = await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization: privileged
    });
    await skillResourceService.ensureDelegatedSkill({ id: archivedSkill.id });

    expect(await listItems(fixture, { skillIds: [skill.id] })).toEqual([]);
    await expectServiceError(
      skillItemService.getSkillItemById({ instance: fixture.instance, skillItemId: item.id }),
      'not_found'
    );
    await expectServiceError(attach(fixture, skill, integration.id), 'not_found');
  });
});
