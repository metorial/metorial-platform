import { firstPage, rejectionOf, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { skillConfigurationService } from '../src';

describe('module-skill-configurations', () => {
  let org = useOrganization();

  it('creates, gets, lists and updates a skill configuration', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let created = await skillConfigurationService.createSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance,
      input: { allowScripts: false, allowedFileExtensions: ['MD', 'txt', '.md'] }
    });
    expect(created.allowScripts).toBe(false);
    expect(created.allowedFileExtensions).toEqual(['.md', '.txt']);
    expect(created.allowNonStandardDirectories).toBe(true);
    expect(created.isDefault).toBeFalsy();

    let fetched = await skillConfigurationService.getSkillConfigurationById({
      project: fixture.project,
      instance: fixture.instance,
      skillConfigurationId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let listed = await firstPage(
      await skillConfigurationService.listSkillConfigurations({
        project: fixture.project,
        instance: fixture.instance,
        ids: [created.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([created.id]);

    let updated = await skillConfigurationService.updateSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance,
      skillConfigurationId: created.id,
      input: { allowScripts: true, allowNonStandardDirectories: false }
    });
    expect(updated.allowScripts).toBe(true);
    expect(updated.allowNonStandardDirectories).toBe(false);
    expect(updated.allowedFileExtensions).toEqual(['.md', '.txt']);
  });

  it('rejects allowed file extensions without .md and empty updates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let invalidExtensions = await rejectionOf(
      skillConfigurationService.createSkillConfiguration({
        project: fixture.project,
        instance: fixture.instance,
        input: { allowedFileExtensions: ['.txt'] }
      })
    );
    expect(invalidExtensions.data.code).toBe('bad_request');

    let created = await skillConfigurationService.createSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance,
      input: {}
    });

    let emptyUpdate = await rejectionOf(
      skillConfigurationService.updateSkillConfiguration({
        project: fixture.project,
        instance: fixture.instance,
        skillConfigurationId: created.id,
        input: {}
      })
    );
    expect(emptyUpdate.data.code).toBe('bad_request');
  });

  it('upserts a single default configuration that cannot be deleted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let first = await skillConfigurationService.getSkillConfigurationById({
      project: fixture.project,
      instance: fixture.instance,
      skillConfigurationId: 'default'
    });
    let second = await skillConfigurationService.upsertDefaultSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance
    });
    expect(first.isDefault).toBe(true);
    expect(second.id).toBe(first.id);

    let defaults = await db.skillConfiguration.count({
      where: { instanceOid: fixture.instance.oid, isDefault: true }
    });
    expect(defaults).toBe(1);

    let error = await rejectionOf(
      skillConfigurationService.deleteSkillConfiguration({
        project: fixture.project,
        instance: fixture.instance,
        skillConfigurationId: 'default'
      })
    );
    expect(error.data.code).toBe('forbidden');
  });

  it('soft-deletes a configuration and hides it from listings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let created = await skillConfigurationService.createSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance,
      input: {}
    });

    let deleted = await skillConfigurationService.deleteSkillConfiguration({
      project: fixture.project,
      instance: fixture.instance,
      skillConfigurationId: created.id
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    let listed = await firstPage(
      await skillConfigurationService.listSkillConfigurations({
        project: fixture.project,
        instance: fixture.instance,
        ids: [created.id]
      })
    );
    expect(listed).toEqual([]);

    let missing = await rejectionOf(
      skillConfigurationService.getSkillConfigurationById({
        project: fixture.project,
        instance: fixture.instance,
        skillConfigurationId: 'skcfg_does_not_exist'
      })
    );
    expect(missing.data.code).toBe('not_found');
  });
});
