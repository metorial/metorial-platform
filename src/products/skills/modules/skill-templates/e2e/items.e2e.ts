import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import {
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import { integrationService } from '@metorial-subspace/module-integration';
import { skillItemService, skillResourceService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { skillTemplateItemService, skillTemplateService } from '../src';
import {
  createSkill,
  createSkillFromTemplate,
  createTemplate,
  scopeOf,
  templateItems
} from './_fixtures';

let createIntegration = async (fixture: OrganizationFixture) =>
  await integrationService.createIntegration({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('template-integration'), description: 'Linked to templates' }
  });

let addIntegration = async (
  fixture: OrganizationFixture,
  skillTemplateId: string,
  integrationId: string
) =>
  await skillTemplateItemService.createSkillTemplateItem({
    instance: fixture.instance,
    skillTemplateId,
    input: { type: 'integration', integrationId }
  });

let listItems = async (fixture: OrganizationFixture, skillTemplateId: string) =>
  await firstPage(
    await skillTemplateItemService.listSkillTemplateItems({
      instance: fixture.instance,
      skillTemplateId
    })
  );

let skillIntegrationIds = async (fixture: OrganizationFixture, skillId: string) =>
  (
    await firstPage(
      await skillItemService.listSkillItems({
        instance: fixture.instance,
        skillIds: [skillId]
      })
    )
  )
    .map(item => item.integration?.id)
    .sort();

describe('module-skill-templates items', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('links an integration once, lists, gets and removes it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let integration = await createIntegration(fixture);

    let item = await addIntegration(fixture, template.id, integration.id);
    expect(item).toMatchObject({
      type: 'integration',
      integration: { id: integration.id },
      provider: null
    });

    let error = await expectServiceError(
      addIntegration(fixture, template.id, integration.id),
      'skill_template_item_exists'
    );
    expect(error.message).toMatch(/already exists/);

    expect((await listItems(fixture, template.id)).map(entry => entry.id)).toEqual([item.id]);
    expect(
      await skillTemplateItemService.getSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      })
    ).toMatchObject({ id: item.id, integration: { id: integration.id } });

    let rows = await subspaceDb.skillTemplateItem.findMany({
      where: { skillTemplate: { id: template.id } },
      include: { integration: true }
    });
    expect(rows.map(row => [row.id, row.integration?.id])).toEqual([
      [item.id, integration.id]
    ]);

    let filtered = await firstPage(
      await skillTemplateService.listSkillTemplates({
        ...scopeOf(fixture),
        integrationIds: [integration.id]
      })
    );
    expect(filtered.map(entry => entry.id)).toEqual([template.id]);

    let removed = await skillTemplateItemService.deleteSkillTemplateItem({
      instance: fixture.instance,
      skillTemplateId: template.id,
      skillTemplateItemId: item.id
    });
    expect(removed.id).toBe(item.id);
    expect(await listItems(fixture, template.id)).toEqual([]);
    await expectServiceError(
      skillTemplateItemService.getSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      }),
      'not_found'
    );
    await expectServiceError(
      skillTemplateItemService.deleteSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      }),
      'not_found'
    );

    expect(await addIntegration(fixture, template.id, integration.id)).toMatchObject({
      integration: { id: integration.id }
    });
  });

  it('copies a skill item onto a template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let skill = await createSkill(fixture);
    let integration = await createIntegration(fixture);
    let skillItem = await skillItemService.createSkillItem({
      instance: fixture.instance,
      input: { skillId: skill.id, type: 'integration', integrationId: integration.id }
    });

    let item = await skillTemplateItemService.addSkillTemplateItem({
      instance: fixture.instance,
      skillTemplateId: template.id,
      input: { skillItemId: skillItem.id }
    });
    expect(item).toMatchObject({ type: 'integration', integration: { id: integration.id } });

    await expectServiceError(
      skillTemplateItemService.addSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        input: { skillItemId: skillItem.id }
      }),
      'skill_template_item_exists'
    );
    await expectServiceError(
      skillTemplateItemService.addSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        input: { skillItemId: 'ski_does_not_exist' }
      }),
      'not_found'
    );
  });

  it('rejects unknown, archived and foreign targets', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createTemplate(fixture);

    await expectServiceError(
      addIntegration(fixture, template.id, 'int_does_not_exist'),
      'not_found'
    );
    await expectServiceError(
      skillTemplateItemService.createSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        input: { type: 'provider', providerId: uniqueId('missing-provider') }
      }),
      'not_found'
    );

    let archivedIntegration = await createIntegration(fixture);
    await integrationService.archiveIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration: archivedIntegration
    });
    await expectServiceError(
      addIntegration(fixture, template.id, archivedIntegration.id),
      'not_found'
    );

    let foreignIntegration = await createIntegration(other);
    await expectServiceError(
      addIntegration(fixture, template.id, foreignIntegration.id),
      'not_found'
    );

    let foreignSkill = await createSkill(other);
    let foreignSkillItem = await skillItemService.createSkillItem({
      instance: other.instance,
      input: {
        skillId: foreignSkill.id,
        type: 'integration',
        integrationId: foreignIntegration.id
      }
    });
    await expectServiceError(
      skillTemplateItemService.addSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        input: { skillItemId: foreignSkillItem.id }
      }),
      'not_found'
    );

    expect(await listItems(fixture, template.id)).toEqual([]);
  });

  it('hides template items from other organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createTemplate(fixture);
    let item = await addIntegration(
      fixture,
      template.id,
      (await createIntegration(fixture)).id
    );
    let otherIntegration = await createIntegration(other);

    await expectServiceError(
      skillTemplateItemService.listSkillTemplateItems({
        instance: other.instance,
        skillTemplateId: template.id
      }),
      'not_found'
    );
    await expectServiceError(
      skillTemplateItemService.getSkillTemplateItem({
        instance: other.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      }),
      'not_found'
    );
    await expectServiceError(
      addIntegration(other, template.id, otherIntegration.id),
      'not_found'
    );
    await expectServiceError(
      skillTemplateItemService.deleteSkillTemplateItem({
        instance: other.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      }),
      'not_found'
    );

    expect((await listItems(fixture, template.id)).map(entry => entry.id)).toEqual([item.id]);
  });

  it('freezes the items of archived templates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture);
    let item = await addIntegration(
      fixture,
      template.id,
      (await createIntegration(fixture)).id
    );
    let integration = await createIntegration(fixture);

    await skillTemplateService.deleteSkillTemplate({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skillTemplateId: template.id
    });

    await expectServiceError(addIntegration(fixture, template.id, integration.id), 'gone');
    await expectServiceError(
      skillTemplateItemService.deleteSkillTemplateItem({
        instance: fixture.instance,
        skillTemplateId: template.id,
        skillTemplateItemId: item.id
      }),
      'gone'
    );
    expect((await listItems(fixture, template.id)).map(entry => entry.id)).toEqual([item.id]);
  });

  it('lists the items of system templates', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let plain = await skillTemplateService.getDefaultSkillTemplate(scopeOf(fixture));

    expect(await listItems(fixture, plain.id)).toEqual([]);
  });

  it('copies template items into skills created from it, without linking them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createTemplate(fixture, { items: templateItems() });
    let first = await createIntegration(fixture);
    let second = await createIntegration(fixture);
    let firstItem = await addIntegration(fixture, template.id, first.id);
    await addIntegration(fixture, template.id, second.id);

    let skill = await createSkillFromTemplate(fixture, template);
    await skillResourceService.copyDelegatedTemplateResourcesToSkill({
      skillTemplate: template,
      skill
    });

    let expected = [first.id, second.id].sort();
    expect(await skillIntegrationIds(fixture, skill.id)).toEqual(expected);

    await skillTemplateItemService.deleteSkillTemplateItem({
      instance: fixture.instance,
      skillTemplateId: template.id,
      skillTemplateItemId: firstItem.id
    });
    await addIntegration(fixture, template.id, (await createIntegration(fixture)).id);

    expect(await skillIntegrationIds(fixture, skill.id)).toEqual(expected);
  });

  it('copies skill items onto a template created from the skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let integration = await createIntegration(fixture);
    await skillItemService.createSkillItem({
      instance: fixture.instance,
      input: { skillId: skill.id, type: 'integration', integrationId: integration.id }
    });

    let template = await createTemplate(fixture, { skillId: skill.id });
    await skillResourceService.copyDelegatedSkillResourcesToTemplate({
      skill,
      skillTemplate: template
    });

    expect((await listItems(fixture, template.id)).map(item => item.integration?.id)).toEqual([
      integration.id
    ]);

    let laterIntegration = await createIntegration(fixture);
    await skillItemService.createSkillItem({
      instance: fixture.instance,
      input: { skillId: skill.id, type: 'integration', integrationId: laterIntegration.id }
    });
    expect((await listItems(fixture, template.id)).map(item => item.integration?.id)).toEqual([
      integration.id
    ]);
  });
});
