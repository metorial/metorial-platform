import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import {
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { skillTemplateItemService, skillTemplateService } from '../src';

let createSkillTemplate = async (fixture: OrganizationFixture, name = uniqueId('template')) =>
  await skillTemplateService.createSkillTemplate({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skillTemplate'),
      name,
      description: 'Created by the e2e suite',
      items: [
        { path: '/SKILL.md', type: 'document', content: '# E2E\n', encoding: 'utf-8' },
        { path: '/references/', type: 'directory' }
      ]
    }
  });

describe('module-skill-templates', () => {
  let org = useOrganization();

  it('creates, gets, lists and updates a tenant skill template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('template');

    let template = await createSkillTemplate(fixture, name);
    expect(template.name).toBe(name);
    expect(template.owner).toBe('tenant');
    expect(template.status).toBe('active');
    expect(template.storeTemplate?.items.map(item => item.path).sort()).toEqual([
      '/SKILL.md',
      '/references/'
    ]);

    let fetched = await skillTemplateService.getSkillTemplateById({
      project: fixture.project,
      instance: fixture.instance,
      skillTemplateId: template.id
    });
    expect(fetched.id).toBe(template.id);

    let listed = await firstPage(
      await skillTemplateService.listSkillTemplates({
        project: fixture.project,
        instance: fixture.instance,
        ids: [template.id],
        owners: ['tenant']
      })
    );
    expect(listed.map(item => item.id)).toEqual([template.id]);

    let renamed = uniqueId('renamed-template');
    let updated = await skillTemplateService.updateSkillTemplate({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillTemplateId: template.id,
      input: {
        name: renamed,
        description: null,
        items: [
          { path: '/SKILL.md', type: 'document', content: '# Renamed\n', encoding: 'utf-8' }
        ]
      }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.description).toBeNull();
    expect(updated.storeTemplate?.name).toBe(renamed);
    expect(updated.storeTemplate?.items.map(item => item.path)).toEqual(['/SKILL.md']);
  });

  it('exposes the system plain template as read-only for tenants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let plain = await skillTemplateService.getDefaultSkillTemplate({
      project: fixture.project,
      instance: fixture.instance
    });
    expect(plain.systemIdentifier).toBe('plain');
    expect(plain.owner).toBe('system');

    let listed = await firstPage(
      await skillTemplateService.listSkillTemplates({
        project: fixture.project,
        instance: fixture.instance,
        ids: [plain.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([plain.id]);

    let error = await rejectionOf(
      skillTemplateService.updateSkillTemplate({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skillTemplateId: plain.id,
        input: { name: uniqueId('hijacked') }
      })
    );
    expect(error.data.code).toBe('bad_request');
  });

  it('archives a skill template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createSkillTemplate(fixture);

    let archived = await skillTemplateService.deleteSkillTemplate({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillTemplateId: template.id
    });
    expect(archived.status).toBe('archived');

    let active = await firstPage(
      await skillTemplateService.listSkillTemplates({
        project: fixture.project,
        instance: fixture.instance,
        ids: [template.id],
        statuses: ['active']
      })
    );
    expect(active).toEqual([]);

    let missing = await rejectionOf(
      skillTemplateService.getSkillTemplateById({
        project: fixture.project,
        instance: fixture.instance,
        skillTemplateId: 'sktpl_does_not_exist'
      })
    );
    expect(missing.data.code).toBe('not_found');
  });

  it('projects tenant templates into the integrations database with no items', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createSkillTemplate(fixture);

    let items = await firstPage(
      await skillTemplateItemService.listSkillTemplateItems({
        instance: fixture.instance,
        skillTemplateId: template.id
      })
    );
    expect(items).toEqual([]);

    let projected = await subspaceDb.skillTemplate.findFirstOrThrow({
      where: { id: template.id }
    });
    expect(projected.owner).toBe('tenant');

    let error = await rejectionOf(
      skillTemplateItemService.createSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        input: { type: 'integration', integrationId: 'int_does_not_exist' }
      })
    );
    expect(error.data.code).toBe('not_found');
  });
});
