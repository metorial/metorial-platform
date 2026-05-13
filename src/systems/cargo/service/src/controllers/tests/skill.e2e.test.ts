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
    let reader = await createActor(tenant.id, {
      identifier: 'skill-reader',
      name: 'Skill Reader'
    });

    let created = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_support',
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

    let readerAccess = await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      actorId: reader.id,
      permissions: ['content_read']
    });
    let upgradedReaderAccess = await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: created.id,
      actorId: reader.id,
      permissions: ['content_read', 'content_write']
    });

    expect(readerAccess).toMatchObject({
      skillId: created.id,
      storeId: created.storeId,
      actorId: reader.id,
      permissions: ['content_read']
    });
    expect(upgradedReaderAccess).toMatchObject({
      skillId: created.id,
      storeId: created.storeId,
      actorId: reader.id,
      permissions: ['content_read', 'content_write']
    });

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
      name: 'Skill Template Source',
      access: 'public_read'
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

  it('creates skill templates from skillId by snapshotting the skill store into a duplicated source store', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_template_source_skill',
      name: 'Template Source Skill'
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_template_source_skill',
      title: 'Readme',
      content: 'snapshot me',
      store: {
        id: skill.storeId,
        path: '/docs/readme.md'
      }
    });

    let created = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_from_skill',
      skillId: skill.id,
      name: 'Template From Skill'
    });

    let templateSourceStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.storeTemplate.sourceStoreId!
    });
    let templateSourceItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: templateSourceStore.id,
      limit: 20
    });
    let templateSourceDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: templateSourceItems.items.find(item => item.path === '/docs/readme.md')!.documentId!
    });

    await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: 'cdoc_template_source_late_change',
      title: 'Later Change',
      content: 'should not be included',
      store: {
        id: skill.storeId,
        path: '/docs/later.md'
      }
    });

    let instantiatedSkill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_instantiated_from_skill_template',
      parentSkillTemplateId: created.id,
      name: 'Instantiated From Template'
    });
    let instantiatedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: instantiatedSkill.storeId,
      limit: 20
    });
    let templateRecord = await db.skillTemplate.findUnique({
      where: {
        id: created.id
      }
    });

    expect(created.storeTemplate.type).toBe('linked_store');
    expect(created.storeTemplate.sourceStoreId).toBeTruthy();
    expect(created.storeTemplate.sourceStoreId).not.toBe(skill.storeId);
    expect(templateSourceStore.cloneType).toBe('duplicate');
    expect(templateSourceItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(templateSourceItems.items.map(item => item.path)).not.toContain('/docs/later.md');
    expect(templateSourceDocument.content).toBe('snapshot me');
    expect(templateRecord?.storeTemplateOid).toBeTruthy();
    expect(instantiatedItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(instantiatedItems.items.map(item => item.path)).not.toContain('/docs/later.md');
  });

  it('preserves standalone file template mime types when instantiating skills', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'skill-template-file-creator',
      name: 'Skill Template File Creator'
    });
    let skillTemplate = await cargoClient.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateId: 'cskt_standalone_file_template',
      name: 'Standalone File Template',
      items: [
        {
          path: '/assets/',
          type: 'directory'
        },
        {
          path: '/assets/readme.txt',
          type: 'file',
          content: 'template file content',
          encoding: 'utf-8',
          mimeType: 'text/plain'
        }
      ]
    });

    let instantiatedSkill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_from_standalone_file_template',
      actorId: actor.id,
      parentSkillTemplateId: skillTemplate.id,
      name: 'From Standalone File Template'
    });
    let skillTemplateRecord = await db.skillTemplate.findUniqueOrThrow({
      where: {
        id: skillTemplate.id
      }
    });
    let templateItemRecord = await db.storeTemplateItem.findFirst({
      where: {
        storeTemplateOid: skillTemplateRecord.storeTemplateOid,
        path: '/assets/readme.txt'
      }
    });
    let createdFileItem = await db.storeItem.findFirst({
      where: {
        store: {
          id: instantiatedSkill.storeId
        },
        path: '/assets/readme.txt'
      },
      include: {
        file: true
      }
    });

    expect(templateItemRecord?.mimeType).toBe('text/plain');
    expect(createdFileItem?.file?.fileType).toBe('text/plain');
  });

  it('rejects skill template creation when more than one source input is provided', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_source_for_validation',
      name: 'Validation Source Skill'
    });

    await expect(
      cargoClient.skillTemplate.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        skillTemplateId: 'cskt_invalid_template_source',
        skillId: skill.id,
        storeId: skill.storeId,
        name: 'Invalid Template Source'
      })
    ).rejects.toThrow('Provide exactly one of skillId, storeId, or items when creating a skill template');
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
      skillTemplateId: 'cskt_global_skill_template',
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
      skillTemplateId: 'cskt_scoped_skill_template',
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
