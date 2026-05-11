import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-skills',
    name: 'Tenant Skills'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  return {
    tenant,
    environment
  };
};

let createActor = async (
  tenantId: string,
  d: {
    identifier: string;
    name: string;
  }
) =>
  await cargoClient.actor.upsert({
    tenantId,
    identifier: d.identifier,
    name: d.name
  });

describe('cargo skill.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, lists, gets, updates, and deletes skills with linked stores', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-creator',
      name: 'Skill Creator'
    });

    let created = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: actor.id,
      name: 'Support'
    });

    let listed = await cargoClient.skill.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let fetched = await cargoClient.skill.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id
    });

    let linkedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });
    let createdSkillRecord = await db.skill.findUnique({
      where: {
        id: created.id
      }
    });
    let linkedStoreRecord = await db.store.findUnique({
      where: {
        id: created.storeId
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: created.storeId
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      storeId: expect.any(String),
      store: {
        id: expect.any(String),
        name: 'Support',
        itemCount: 1
      }
    });
    expect(linkedStore).toMatchObject({
      id: created.storeId,
      name: 'Support'
    });
    expect(createdSkillRecord?.createdByTenantActorOid).toBeTruthy();
    expect(linkedStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.store.id).toBe(created.storeId);

    let updated = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      name: 'Customer Support'
    });

    let updatedStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeId
    });

    expect(updated).toMatchObject({
      id: created.id,
      storeId: created.storeId,
      store: {
        id: created.storeId,
        name: 'Customer Support'
      }
    });
    expect(updatedStore.name).toBe('Customer Support');

    await expect(
      cargoClient.store.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: created.storeId
      })
    ).rejects.toThrow('Cannot delete store: it is linked to a skill');

    let deleted = await cargoClient.skill.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id
    });

    let listedAfterDelete = await cargoClient.skill.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let deletedSkill = await db.skill.findUnique({
      where: {
        id: created.id
      }
    });
    let deletedStore = await db.store.findUnique({
      where: {
        id: created.storeId
      }
    });

    expect(deleted.id).toBe(created.id);
    expect(deleted.storeId).toBe(created.storeId);
    expect(listedAfterDelete.items).toHaveLength(0);
    expect(deletedSkill).toBeNull();
    expect(deletedStore).toBeNull();
  });

  it('creates skills from skill-template parents by cloning the underlying store template', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-template-creator',
      name: 'Skill Template Creator'
    });
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_skill_template_source_store',
      name: 'Skill Template Source'
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_skill_template_source_document',
      title: 'Readme',
      content: 'template-backed content',
      store: {
        id: sourceStore.id,
        path: '/docs/readme.md'
      }
    });

    let skillTemplate = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_skill_parent_template',
      storeId: sourceStore.id,
      name: 'Starter Skill Template'
    });

    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_from_template_parent',
      actorId: actor.id,
      parentSkillTemplateId: skillTemplate.id,
      name: 'Skill From Template Parent'
    });

    let skillRecord = await db.skill.findUnique({
      where: {
        id: skill.id
      }
    });
    let skillTemplateRecord = await db.skillTemplate.findUnique({
      where: {
        id: skillTemplate.id
      }
    });
    let createdStoreRecord = await db.store.findUnique({
      where: {
        id: skill.storeId
      }
    });
    let createdItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      limit: 20
    });
    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdItems.items.find(item => item.path === '/docs/readme.md')!.documentId!
    });
    let createdDocumentRecord = await db.document.findUnique({
      where: {
        id: createdDocument.id
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: skill.storeId
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(skill).toMatchObject({
      id: 'csk_from_template_parent',
      storeId: expect.any(String),
      parentSkillTemplateId: skillTemplate.id
    });
    expect(skill.parentSkillId).toBeUndefined();
    expect(skill.store.cloneType).toBe('duplicate');
    expect(skillRecord?.parentSkillTemplateOid).toBe(skillTemplateRecord?.oid);
    expect(skillRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdStoreRecord?.parentStoreTemplateOid).toBe(skillTemplateRecord?.storeTemplateOid);
    expect(createdStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(createdDocument.content).toBe('template-backed content');
    expect(createdDocumentRecord?.parentDocumentOid).toBeNull();
    expect(createdDocumentRecord?.isContentOwner).toBe(true);
    expect(createdDocumentRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
  });

  it('lists and gets global skill templates but only mutates matching scoped templates', async () => {
    let { tenant, environment } = await createScope();
    let otherTenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-skills-other',
      name: 'Tenant Skills Other'
    });
    let otherEnvironment = await cargoClient.environment.upsert({
      tenantId: otherTenant.id,
      identifier: 'prod-other',
      name: 'Production Other',
      type: 'production'
    });

    let globalTemplate = await cargoClient.skillTemplate.create({
      name: 'Global Skill Template',
      items: [
        {
          path: '/docs/readme.md',
          type: 'document',
          content: 'global template',
          encoding: 'utf-8'
        }
      ]
    });
    let scopedTemplate = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Scoped Skill Template',
      items: [
        {
          path: '/docs/readme.md',
          type: 'document',
          content: 'scoped template',
          encoding: 'utf-8'
        }
      ]
    });

    let listed = await cargoClient.skillTemplate.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let fetchedGlobal = await cargoClient.skillTemplate.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: globalTemplate.id
    });

    expect(listed.items.map(item => item.id).sort()).toEqual(
      [globalTemplate.id, scopedTemplate.id].sort()
    );
    expect(fetchedGlobal.id).toBe(globalTemplate.id);

    await expect(
      cargoClient.skillTemplate.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillTemplateId: globalTemplate.id
      })
    ).rejects.toThrow(
      'Skill template updates and deletes are only allowed within the matching tenant and environment'
    );

    await expect(
      cargoClient.skillTemplate.update({
        tenantId: otherTenant.id,
        environmentId: otherEnvironment.id,
        skillTemplateId: scopedTemplate.id,
        name: 'Wrong Scope Update'
      })
    ).rejects.toThrow('skillTemplate');

    let updated = await cargoClient.skillTemplate.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: scopedTemplate.id,
      name: 'Scoped Skill Template Updated'
    });

    expect(updated).toMatchObject({
      storeTemplate: {
        name: 'Scoped Skill Template Updated'
      }
    });
  });
});
