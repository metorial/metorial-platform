import { rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { accessTagService, consumerSkillReadRoles } from '@metorial/module-access';
import { skillContentPreviewService } from '@metorial/module-skill';
import { storeService } from '@metorial/module-store';
import { describe, expect, it } from 'vitest';
import {
  addDocument,
  createSkill,
  createTemplate,
  privileged,
  readStoreDocument,
  scopeOf,
  templateItems
} from './_fixtures';

describe('skill content previews', () => {
  let org = useOrganization();

  it('previews skills and skill templates in a single request', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let standaloneTemplate = await createTemplate(fixture, {
      items: templateItems('Standalone body')
    });
    let linkedStore = await storeService.createStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { name: uniqueId('store'), access: 'private' }
    });
    await addDocument(fixture, linkedStore.id, '/SKILL.md', '# Linked\n\nFrom a store\n');
    let linkedTemplate = await createTemplate(fixture, { storeId: linkedStore.id });

    let skillContent =
      (await readStoreDocument(fixture, skill.store!.id, '/SKILL.md')) ?? null;
    let linkedContent = await readStoreDocument(fixture, linkedStore.id, '/SKILL.md');
    expect(linkedContent).toContain('From a store');

    let previews = await skillContentPreviewService.listSkillContentPreviews({
      ...scopeOf(fixture),
      authorization: privileged,
      skillIds: [skill.id],
      skillTemplateIds: [standaloneTemplate.id, linkedTemplate.id, 'sktm_missing']
    });

    expect(previews).toEqual([
      { type: 'skill', skillId: skill.id, content: skillContent },
      {
        type: 'skill_template',
        skillTemplateId: standaloneTemplate.id,
        content: '# Template\n\nStandalone body\n'
      },
      { type: 'skill_template', skillTemplateId: linkedTemplate.id, content: linkedContent }
    ]);
  });

  it('rejects requests for more than 50 skills and skill templates combined', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let error = await rejectionOf(
      skillContentPreviewService.listSkillContentPreviews({
        ...scopeOf(fixture),
        authorization: privileged,
        skillIds: Array.from({ length: 30 }, (_, i) => `skl_${i}`),
        skillTemplateIds: Array.from({ length: 21 }, (_, i) => `sktm_${i}`)
      })
    );

    expect(error).toBeTruthy();
  });

  it('only previews skill templates shared with a consumer access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let shared = await createTemplate(fixture, { items: templateItems('Shared body') });
    let unshared = await createTemplate(fixture, { items: templateItems('Unshared body') });

    let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });
    let policy = await db.accessTagPolicy.create({
      data: {
        id: await ID.generateId('accessTagPolicy'),
        name: uniqueId('policy'),
        roles: [...consumerSkillReadRoles],
        organizationOid: fixture.organization.oid
      }
    });
    await db.accessTagEntity.create({
      data: {
        accessTagOid: accessTag.oid,
        accessTagPolicyOid: policy.oid,
        skillTemplateOid: shared.oid
      }
    });

    let previews = await skillContentPreviewService.listSkillContentPreviews({
      ...scopeOf(fixture),
      authorization: privileged,
      accessTags: [{ accessTagOid: accessTag.oid }],
      skillIds: [],
      skillTemplateIds: [shared.id, unshared.id]
    });

    expect(previews).toEqual([
      {
        type: 'skill_template',
        skillTemplateId: shared.id,
        content: '# Template\n\nShared body\n'
      }
    ]);
  });
});
