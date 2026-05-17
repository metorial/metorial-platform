import { flushDocumentDraft } from '@metorial-cargo/module-doc';
import { skillMarketplaceService, skillPluginService } from '@metorial-cargo/module-skill';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getId } from '../../db';
import { storeVersionService } from '@metorial-cargo/module-store';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let subtractHours = (date: Date, hours: number) =>
  new Date(date.getTime() - hours * 60 * 60 * 1000);

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

let getCargoScopeRecords = async (d: { tenantId: string; environmentId: string }) => ({
  tenant: await db.tenant.findUniqueOrThrow({
    where: {
      id: d.tenantId
    }
  }),
  environment: await db.environment.findUniqueOrThrow({
    where: {
      id: d.environmentId
    }
  })
});

let createTestSkillDestination = async (codeBucketId: string) =>
  await db.skillDestination.create({
    data: {
      ...getId('skillDestination'),
      codeBucketId
    }
  });

let createTestSkillPlugin = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  name: string;
  slug: string;
}) => {
  let destination = await createTestSkillDestination(`plugin-${d.slug}`);

  return await db.skillPlugin.create({
    data: {
      ...getId('skillPlugin'),
      status: 'active',
      isManaged: false,
      name: d.name,
      slug: d.slug,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      destinationOid: destination.oid
    }
  });
};

let createTestSkillMarketplace = async (d: {
  tenantOid: bigint;
  environmentOid: bigint;
  name: string;
  slug: string;
}) => {
  let destination = await createTestSkillDestination(`marketplace-${d.slug}`);

  return await db.skillMarketplace.create({
    data: {
      ...getId('skillMarketplace'),
      status: 'active',
      name: d.name,
      slug: d.slug,
      tenantOid: d.tenantOid,
      environmentOid: d.environmentOid,
      destinationOid: destination.oid
    }
  });
};

let createTestSkillPluginSkill = async (d: {
  skillOid: bigint;
  skillPluginOid: bigint;
  pluginSkillSlug: string;
}) =>
  await db.skillPluginSkill.create({
    data: {
      ...getId('skillPluginSkill'),
      status: 'active',
      pluginSkillSlug: d.pluginSkillSlug,
      clientName: 'Plugin Skill',
      skillOid: d.skillOid,
      skillPluginOid: d.skillPluginOid
    }
  });

let createTestSkillMarketplacePlugin = async (d: {
  skillMarketplaceOid: bigint;
  skillPluginOid: bigint;
  pluginSlug: string;
}) =>
  await db.skillMarketplacePlugin.create({
    data: {
      ...getId('skillMarketplacePlugin'),
      status: 'active',
      pluginSlug: d.pluginSlug,
      skillMarketplaceOid: d.skillMarketplaceOid,
      skillPluginOid: d.skillPluginOid
    }
  });

describe('cargo skill.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('filters skill exports by creator actor', async () => {
    let { tenant, environment } = await createScope();
    let firstActor = await createActor(tenant.id, {
      identifier: 'skill-export-first',
      name: 'Skill Export First'
    });
    let secondActor = await createActor(tenant.id, {
      identifier: 'skill-export-second',
      name: 'Skill Export Second'
    });
    let { tenant: tenantRecord, environment: environmentRecord } = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let firstActorRecord = await db.tenantActor.findUniqueOrThrow({
      where: {
        id: firstActor.id
      }
    });
    let secondActorRecord = await db.tenantActor.findUniqueOrThrow({
      where: {
        id: secondActor.id
      }
    });

    let firstExportRef = await db.skillExportRef.create({
      data: {
        oid: getId('skillExport').oid,
        hash: 'test-export-first',
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let secondExportRef = await db.skillExportRef.create({
      data: {
        oid: getId('skillExport').oid,
        hash: 'test-export-second',
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let firstExportIds = getId('skillExport');
    let secondExportIds = getId('skillExport');

    let firstExport = await db.skillExport.create({
      data: {
        ...firstExportIds,
        target: 'plugin',
        status: 'completed',
        exportRefOid: firstExportRef.oid,
        creatorTenantActorOid: firstActorRecord.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let secondExport = await db.skillExport.create({
      data: {
        ...secondExportIds,
        target: 'plugin',
        status: 'completed',
        exportRefOid: secondExportRef.oid,
        creatorTenantActorOid: secondActorRecord.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });

    let listedForFirstActor = await cargoClient.skillExport.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: firstActor.id,
      limit: 10
    });

    expect(listedForFirstActor.items.map(item => item.id)).toEqual([firstExport.id]);
    expect(
      await cargoClient.skillExport.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        actorId: firstActor.id,
        skillExportId: firstExport.id
      })
    ).toMatchObject({
      id: firstExport.id,
      createdBy: {
        id: firstActor.id
      }
    });
    await expect(
      cargoClient.skillExport.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        actorId: firstActor.id,
        skillExportId: secondExport.id
      })
    ).rejects.toThrow();
  });

  it('creates, lists, gets, and updates skills with linked stores', async () => {
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
  });

  it('archives plugin links when archiving a plugin', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_delete_plugin',
      name: 'Delete Plugin Skill'
    });
    let skillRecord = await db.skill.findUniqueOrThrow({
      where: {
        id: skill.id
      }
    });
    let skillPlugin = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Plugin To Delete',
      slug: 'plugin-to-delete'
    });
    let skillMarketplace = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Plugin Delete Marketplace',
      slug: 'plugin-delete-marketplace'
    });
    let skillPluginSkill = await createTestSkillPluginSkill({
      skillOid: skillRecord.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSkillSlug: 'plugin-delete-skill'
    });
    let skillMarketplacePlugin = await createTestSkillMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSlug: 'plugin-delete'
    });

    await skillPluginService.archiveSkillPlugin({
      tenant: scope.tenant,
      environment: scope.environment,
      skillPlugin: await skillPluginService.getSkillPluginById({
        tenant: scope.tenant,
        environment: scope.environment,
        skillPluginId: skillPlugin.id
      })
    });

    let deletedSkillPlugin = await db.skillPlugin.findUniqueOrThrow({
      where: {
        id: skillPlugin.id
      }
    });
    let deletedSkillPluginSkill = await db.skillPluginSkill.findUniqueOrThrow({
      where: {
        id: skillPluginSkill.id
      }
    });
    let deletedSkillMarketplacePlugin =
      await db.skillMarketplacePlugin.findUniqueOrThrow({
        where: {
          id: skillMarketplacePlugin.id
        }
      });

    expect(deletedSkillPlugin.status).toBe('archived');
    expect(deletedSkillPluginSkill.status).toBe('archived');
    expect(deletedSkillMarketplacePlugin.status).toBe('archived');
  });

  it('archives marketplace plugins when archiving a marketplace', async () => {
    let { tenant, environment } = await createScope();
    let scope = await getCargoScopeRecords({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    let skillPlugin = await createTestSkillPlugin({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Marketplace Plugin',
      slug: 'marketplace-plugin'
    });
    let skillMarketplace = await createTestSkillMarketplace({
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      name: 'Marketplace To Delete',
      slug: 'marketplace-to-delete'
    });
    let skillMarketplacePlugin = await createTestSkillMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace.oid,
      skillPluginOid: skillPlugin.oid,
      pluginSlug: 'marketplace-plugin'
    });

    await skillMarketplaceService.archiveSkillMarketplace({
      tenant: scope.tenant,
      environment: scope.environment,
      skillMarketplace: await skillMarketplaceService.getSkillMarketplaceById({
        tenant: scope.tenant,
        environment: scope.environment,
        skillMarketplaceId: skillMarketplace.id
      })
    });

    let deletedSkillMarketplace = await db.skillMarketplace.findUniqueOrThrow({
      where: {
        id: skillMarketplace.id
      }
    });
    let deletedSkillMarketplacePlugin =
      await db.skillMarketplacePlugin.findUniqueOrThrow({
        where: {
          id: skillMarketplacePlugin.id
        }
      });

    expect(deletedSkillMarketplace.status).toBe('archived');
    expect(deletedSkillMarketplacePlugin.status).toBe('archived');
  });

  it('sets, replaces, and clears skill images with file references', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'skill_image',
      name: 'Skill Image',
      ownerType: 'instance',
      canHaveLinks: true
    });

    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_image',
      name: 'Image Skill'
    });
    let firstFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-skill-image-1',
      name: 'skill-one.png',
      mimeType: 'image/png',
      size: 128,
      title: 'Skill image one'
    });
    let secondFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-skill-image-2',
      name: 'skill-two.png',
      mimeType: 'image/png',
      size: 256,
      title: 'Skill image two'
    });

    let withFirstImage = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: firstFile.id
    });
    let firstImage = withFirstImage.image as any;
    expect(firstImage).toMatchObject({
      type: 'file',
      fileId: firstFile.id,
      fileLinkId: expect.any(String),
      fileReferenceId: expect.any(String)
    });

    let withSecondImage = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: secondFile.id
    });
    let secondImage = withSecondImage.image as any;
    expect(secondImage).toMatchObject({
      type: 'file',
      fileId: secondFile.id,
      fileLinkId: expect.any(String),
      fileReferenceId: expect.any(String)
    });
    expect(secondImage.fileReferenceId).not.toBe(firstImage.fileReferenceId);

    let oldReference = await db.fileReference.findUnique({
      where: {
        id: firstImage.fileReferenceId
      }
    });
    let oldLink = await db.fileLink.findUnique({
      where: {
        id: firstImage.fileLinkId
      }
    });
    expect(oldReference).toBeNull();
    expect(oldLink).toBeNull();

    let referencesAfterReplace = await db.fileReference.findMany({
      where: {
        entityType: 'skill',
        entityId: skill.id
      }
    });
    expect(referencesAfterReplace).toHaveLength(1);
    expect(referencesAfterReplace[0]!.id).toBe(secondImage.fileReferenceId);

    let cleared = await cargoClient.skill.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      imageFileId: null
    });

    expect(cleared.image).toEqual({ type: 'default' });
    expect(
      await db.fileReference.findUnique({
        where: {
          id: secondImage.fileReferenceId
        }
      })
    ).toBeNull();
    expect(
      await db.fileLink.findUnique({
        where: {
          id: secondImage.fileLinkId
        }
      })
    ).toBeNull();
  });

  it('manages skill agents from markdown documents in skill stores', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_agents',
      name: 'Agent Skill'
    });

    let createdAgent = await cargoClient.skillAgent.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      name: 'Research Assistant',
      description: 'Find useful information',
      content: 'agent instructions'
    });

    expect(createdAgent).toMatchObject({
      skillId: skill.id,
      name: 'Research Assistant',
      description: 'Find useful information',
      slug: 'research-assistant',
      status: 'active',
      path: '/agents/research-assistant.md',
      documentId: expect.any(String),
      storeItemId: expect.any(String)
    });

    let updatedAgent = await cargoClient.skillAgent.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: createdAgent.id,
      name: 'Research Lead',
      description: null
    });

    expect(updatedAgent).toMatchObject({
      id: createdAgent.id,
      name: 'Research Lead',
      description: null,
      slug: 'research-assistant',
      path: '/agents/research-assistant.md'
    });

    await expect(
      cargoClient.document.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        documentId: createdAgent.documentId
      })
    ).rejects.toThrow('Cannot delete document: it is linked to an active skill agent');

    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdAgent.documentId
    });

    await expect(
      cargoClient.file.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: createdDocument.fileId
      })
    ).rejects.toThrow('Cannot delete file: it is linked to an active skill agent');

    let manualDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Manual Agent',
      content: 'manual instructions',
      store: {
        id: skill.storeId,
        path: '/agents/manual.md'
      }
    });

    let listedAfterManual = await cargoClient.skillAgent.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      limit: 10
    });
    let manualAgent = listedAfterManual.items.find(
      item => item.documentId === manualDocument.id
    )!;

    expect(manualAgent).toMatchObject({
      name: 'Manual Agent',
      slug: 'manual',
      path: '/agents/manual.md',
      status: 'active'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      operations: [
        {
          type: 'modify',
          itemId: manualAgent.storeItemId,
          path: '/agents/manual-renamed.md'
        }
      ]
    });

    let renamedAgent = await cargoClient.skillAgent.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: manualAgent.id
    });

    expect(renamedAgent).toMatchObject({
      name: 'manual-renamed',
      slug: 'manual-renamed',
      path: '/agents/manual-renamed.md',
      status: 'active'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: skill.storeId,
      operations: [
        {
          type: 'modify',
          itemId: renamedAgent.storeItemId,
          path: '/docs/manual-renamed.md'
        }
      ]
    });

    let archivedAfterMove = await cargoClient.skillAgent.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      includeArchived: true,
      limit: 10
    });
    let movedAgent = archivedAfterMove.items.find(item => item.id === manualAgent.id)!;

    expect(movedAgent).toMatchObject({
      status: 'archived',
      storeItemId: undefined,
      archivedAt: expect.any(Date)
    });

    let deletedAgent = await cargoClient.skillAgent.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillAgentId: createdAgent.id
    });
    let removedStoreItem = await db.storeItem.findFirst({
      where: {
        id: createdAgent.storeItemId
      }
    });
    let deletedDocument = await cargoClient.document.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdAgent.documentId
    });

    expect(deletedAgent.status).toBe('archived');
    expect(deletedAgent.storeItemId).toBeUndefined();
    expect(removedStoreItem).toBeNull();
    expect(deletedDocument.status).toBe('deleted');

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'skill_agent_restricted_file',
      name: 'Skill Agent Restricted File',
      ownerType: 'organization',
      canHaveLinks: true
    });

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        storeId: 'skill-agent-restricted-file',
        name: 'bad.md',
        mimeType: 'text/markdown',
        size: 10,
        store: {
          id: skill.storeId,
          path: '/agents/bad.md'
        }
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    await expect(
      cargoClient.document.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        title: 'Bad Agent',
        content: 'bad',
        store: {
          id: skill.storeId,
          path: '/agents/bad.txt'
        }
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'add',
            path: '/agents/folder/'
          }
        ]
      })
    ).rejects.toThrow('Only markdown documents can be added to the agents directory');

    let skillDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Skill Root',
      content: 'root instructions',
      store: {
        id: skill.storeId,
        path: '/SKILL.md'
      }
    });
    let skillDocumentItem = (
      await cargoClient.storeItem.list({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        documentIds: [skillDocument.id],
        limit: 10
      })
    ).items[0]!;

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'remove',
            itemId: skillDocumentItem.id
          }
        ]
      })
    ).rejects.toThrow('SKILL.md cannot be removed from a skill store');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'modify',
            itemId: skillDocumentItem.id,
            path: '/docs/SKILL.md'
          }
        ]
      })
    ).rejects.toThrow('SKILL.md cannot be moved in a skill store');

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        storeId: 'skill-root-file',
        name: 'SKILL.md',
        mimeType: 'text/markdown',
        size: 10,
        store: {
          id: skill.storeId,
          path: '/SKILL.md'
        }
      })
    ).rejects.toThrow('SKILL.md is reserved for documents in skill stores');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: skill.storeId,
        operations: [
          {
            type: 'add',
            path: '/docs/SKILL.md/'
          }
        ]
      })
    ).rejects.toThrow('SKILL.md is reserved for documents in skill stores');
  });

  it('creates skill versions for store snapshots and resolves document version content', async () => {
    let { tenant, environment } = await createScope();
    let skill = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_versioned',
      name: 'Versioned Skill'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Instructions',
      content: 'first content',
      store: {
        id: skill.storeId,
        path: '/instructions.md'
      }
    });
    let staleDirtyAt = subtractHours(new Date(), 2);

    await db.store.update({
      where: {
        id: skill.storeId
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });

    let snapshotResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: skill.storeId,
      expectedDirtyAt: staleDirtyAt
    });

    expect(snapshotResult?.alreadyExisted).toBe(false);

    await db.store.update({
      where: {
        id: skill.storeId
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });

    let idempotentResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: skill.storeId,
      expectedDirtyAt: staleDirtyAt
    });
    let skillVersionsAfterRetry = await db.skillVersion.findMany({
      where: {
        skill: {
          id: skill.id
        }
      }
    });

    expect(idempotentResult?.alreadyExisted).toBe(true);
    expect(skillVersionsAfterRetry).toHaveLength(1);

    await db.documentVersion.update({
      where: {
        id: document.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id,
      content: 'second content'
    });
    await flushDocumentDraft({
      documentId: document.id,
      force: true
    });

    let currentDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id
    });
    let listed = await cargoClient.skillVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      limit: 10
    });
    let fetched = await cargoClient.skillVersion.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillVersionId: listed.items[0]!.id
    });
    let snapshot = await cargoClient.skillVersion.getSnapshot({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: skill.id,
      skillVersionId: listed.items[0]!.id
    });
    let documentItem = snapshot.items.find(item => item.documentId === document.id);

    expect(currentDocument.content).toBe('second content');
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      skillId: skill.id,
      storeId: skill.storeId,
      storeVersionId: snapshotResult?.version.id,
      versionNumber: 1
    });
    expect(fetched.id).toBe(listed.items[0]!.id);
    expect(snapshot).toMatchObject({
      id: listed.items[0]!.id,
      skillId: skill.id,
      storeId: skill.storeId,
      storeVersionId: snapshotResult?.version.id,
      versionNumber: 1
    });
    expect(documentItem).toMatchObject({
      kind: 'document',
      path: '/instructions.md',
      documentId: document.id,
      documentVersionId: document.currentVersionId,
      content: 'first content'
    });
  });

  it('tracks skill participants from creator, store access, use, and forks', async () => {
    let { tenant, environment } = await createScope();
    let creator = await createActor(tenant.id, {
      identifier: 'skill-participant-creator',
      name: 'Skill Participant Creator'
    });
    let viewer = await createActor(tenant.id, {
      identifier: 'skill-participant-viewer',
      name: 'Skill Participant Viewer'
    });
    let editor = await createActor(tenant.id, {
      identifier: 'skill-participant-editor',
      name: 'Skill Participant Editor'
    });
    let forker = await createActor(tenant.id, {
      identifier: 'skill-participant-forker',
      name: 'Skill Participant Forker'
    });

    let parent = await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_participant_parent',
      actorId: creator.id,
      name: 'Participant Parent'
    });

    let afterCreate = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let creatorParticipant = afterCreate.items.find(item => item.actor.id === creator.id);

    expect(creatorParticipant).toMatchObject({
      object: 'cargo#skillParticipant',
      skillId: parent.id,
      roles: expect.arrayContaining(['creator', 'editor']),
      actor: {
        id: creator.id
      }
    });

    let used = await cargoClient.skill.markSkillUse({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      actorId: creator.id
    });

    expect(used).toMatchObject({
      skillId: parent.id,
      roles: expect.arrayContaining(['creator', 'editor', 'user']),
      actor: {
        id: creator.id
      }
    });

    await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: parent.storeId,
      actorId: viewer.id,
      defaultPermissions: ['content_read']
    });
    await cargoClient.skill.upsertActor({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      actorId: editor.id,
      permissions: ['content_read', 'content_write']
    });

    let afterStoreSync = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let viewerParticipant = afterStoreSync.items.find(item => item.actor.id === viewer.id);
    let editorParticipant = afterStoreSync.items.find(item => item.actor.id === editor.id);

    expect(viewerParticipant).toMatchObject({
      skillId: parent.id,
      roles: ['viewer'],
      actor: {
        id: viewer.id
      }
    });
    expect(editorParticipant).toMatchObject({
      skillId: parent.id,
      roles: ['editor'],
      actor: {
        id: editor.id
      }
    });

    let fetchedViewer = await cargoClient.skillParticipant.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillParticipantId: viewerParticipant!.id
    });

    expect(fetchedViewer).toMatchObject({
      id: viewerParticipant!.id,
      skillId: parent.id,
      roles: ['viewer']
    });

    await cargoClient.skill.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: 'csk_participant_child_fork',
      actorId: forker.id,
      parentSkill: {
        skillId: parent.id,
        type: 'fork'
      },
      name: 'Participant Child Fork'
    });

    let afterFork = await cargoClient.skillParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillId: parent.id,
      limit: 10
    });
    let forkerParticipant = afterFork.items.find(item => item.actor.id === forker.id);

    expect(forkerParticipant).toMatchObject({
      skillId: parent.id,
      roles: expect.arrayContaining(['forker']),
      actor: {
        id: forker.id
      }
    });
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
    expect(skillTemplate.storeId).toBe(sourceStore.id);
    expect(skillTemplate.storeTemplate.storeId).toBe(sourceStore.id);
    expect(skill.parentSkillId).toBeUndefined();
    expect(skill.store.cloneType).toBe('duplicate');
    expect(skillRecord?.parentSkillTemplateOid).toBe(skillTemplateRecord?.oid);
    expect(skillRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdStoreRecord?.parentStoreTemplateOid).toBe(
      skillTemplateRecord?.storeTemplateOid
    );
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
      documentId: templateSourceItems.items.find(item => item.path === '/docs/readme.md')!
        .documentId!
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
    ).rejects.toThrow(
      'Provide exactly one of skillId, storeId, or items when creating a skill template'
    );
  });

});
