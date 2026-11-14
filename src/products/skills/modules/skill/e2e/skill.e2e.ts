import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import {
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { skillItemService, skillResourceService, skillService } from '../src';

let authorization = createResourceAuthorization({ restricted: false });

let createSkill = async (fixture: OrganizationFixture, name = uniqueId('skill')) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization,
      name,
      description: 'Created by the e2e suite'
    }
  });

describe('module-skill', () => {
  let org = useOrganization();

  it('creates, gets, lists and updates a skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('skill');

    let skill = await createSkill(fixture, name);
    expect(skill.name).toBe(name);
    expect(skill.status).toBe('active');
    expect(skill.store?.id).toBe(skill.storeId);

    let fetched = await skillService.getSkillById({
      project: fixture.project,
      instance: fixture.instance,
      skillId: skill.id
    });
    expect(fetched.id).toBe(skill.id);

    let listed = await firstPage(
      await skillService.listSkills({
        project: fixture.project,
        instance: fixture.instance,
        ids: [skill.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([skill.id]);

    let renamed = uniqueId('renamed-skill');
    let updated = await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: fetched,
      authorization,
      input: { name: renamed, description: null }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.description).toBeNull();
    expect(updated.store?.name).toBe(renamed);
  });

  it('duplicates a skill into its own store and archives the original', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let original = await createSkill(fixture);

    let duplicate = await skillService.createSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      parentSkill: original,
      parentSkillCloneType: 'duplicate',
      input: {
        id: await ID.generateId('skill'),
        authorization,
        name: uniqueId('duplicate-skill')
      }
    });
    expect(duplicate.parentSkill?.id).toBe(original.id);
    expect(duplicate.storeId).not.toBe(original.storeId);

    let hydrated = await skillResourceService.hydrateSkill(duplicate, {
      instance: fixture.instance
    });
    expect(hydrated.hierarchy.type).toBe('duplicated');
    expect(hydrated.hierarchy.parentSkillId).toBe(original.id);

    await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: original,
      authorization
    });

    await expect(
      skillService.getSkillById({
        project: fixture.project,
        instance: fixture.instance,
        skillId: original.id
      })
    ).rejects.toThrow();

    let archived = await firstPage(
      await skillService.listSkills({
        project: fixture.project,
        instance: fixture.instance,
        ids: [original.id, duplicate.id],
        statuses: ['archived']
      })
    );
    expect(archived.map(item => item.id)).toEqual([original.id]);
  });

  it('projects skills into the integrations database with no items', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    let items = await firstPage(
      await skillItemService.listSkillItems({
        instance: fixture.instance,
        skillIds: [skill.id]
      })
    );
    expect(items).toEqual([]);

    let projected = await subspaceDb.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(projected.name).toBe(skill.name);
    expect(projected.storeId).toBe(skill.storeId);
  });
});
