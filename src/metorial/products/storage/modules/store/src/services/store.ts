import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  normalizeDateFilter,
  resolveResourceActors,
  resolveStores,
  resolveStoreTemplates,
  type DateFilter
} from '@metorial/cargo-list-utils';
import {
  documentInclude,
  documentService,
  rewriteDocumentMarkdownTitle
} from '@metorial/cargo-module-doc';
import {
  filePurposeService,
  fileService,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/cargo-module-file';
import type {
  Instance,
  Project,
  ResourceActor,
  Store,
  StoreAccess,
  StoreCloneType
} from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { assertResourceActorScope } from '@metorial/module-access';
import { posix as pathPosix } from 'node:path';
import { normalizeStorePath } from '../lib/storePath';
import { enqueueStoreLifecycle } from '../queues/lifecycle';
import { storeCleanupManyQueue } from '../queues/storeCleanup';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission,
  type StoreAccessInput
} from './storeAccess';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeItemMutationService, type StoreItemOperationInput } from './storeItemMutation';
import { storeTemplateService, type StoreTemplateRecord } from './storeTemplate';
import { storeVersionService } from './storeVersion';

type StoreServiceAccessInput = StoreAccessInput & {
  actor?: ResourceActor;
};

class StoreServiceImpl {
  private assertStoreWritable(d: { store: Pick<Store, 'id' | 'isReadOnly'> }) {
    if (d.store.isReadOnly) {
      throw new ServiceError(
        badRequestError({
          message: `Store ${d.store.id} is read-only`
        })
      );
    }
  }

  private getTemplateLinkedStoreAccess(d: {
    access?: StoreAccess;
    isTemplateLinked?: boolean;
  }) {
    if (!d.isTemplateLinked) return d.access ?? 'private';
    if (d.access === 'public_write') return 'public_write';

    return 'public_read';
  }

  private async isTemplateLinkedStore(store: Pick<Store, 'oid' | 'parentStoreTemplateOid'>) {
    if (store.parentStoreTemplateOid) return true;

    return (
      (await db.storeTemplate.count({
        where: {
          sourceStoreOid: store.oid
        }
      })) > 0
    );
  }

  private async getStoreRecord(d: { project: Project; instance: Instance; storeId: string }) {
    return await withTransaction(
      async db => {
        let store = await db.store.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            id: d.storeId
          }
        });

        if (!store) throw new ServiceError(notFoundError('store', d.storeId));

        return store;
      },
      { ifExists: true }
    );
  }

  private assertStoreTemplateCloneScope(d: {
    project: Project;
    instance: Instance;
    storeTemplate: Pick<StoreTemplateRecord, 'id' | 'projectOid' | 'instanceOid'>;
  }) {
    if (d.storeTemplate.projectOid && d.storeTemplate.projectOid !== d.project.oid) {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${d.storeTemplate.id} can only be cloned within its linked project`
        })
      );
    }

    if (d.storeTemplate.instanceOid && d.storeTemplate.instanceOid !== d.instance.oid) {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${d.storeTemplate.id} can only be cloned within its linked instance`
        })
      );
    }
  }

  private getStoreTemplateItemName(path: string) {
    let normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    let name = pathPosix.basename(normalizedPath);

    return name || 'template-item';
  }

  private inferMarkdownTitle(content: string) {
    let firstLine = content.match(/^[^\r\n]*/)?.[0] ?? '';
    if (!firstLine.startsWith('#')) return undefined;

    return firstLine.replace(/^#+\s*/, '').trim() || undefined;
  }

  private decodeStoreTemplateItemContent(item: StoreTemplateRecord['items'][number]) {
    if (item.kind === 'directory' || item.content === null || item.encoding === null) {
      throw new ServiceError(
        badRequestError({
          message: `Store template item ${item.id} is missing content`
        })
      );
    }

    return item.encoding === 'base64'
      ? Buffer.from(item.content, 'base64')
      : Buffer.from(item.content, 'utf8');
  }

  private async instantiateStandaloneTemplateItems(d: {
    project: Project;
    instance: Instance;
    store: Store;
    storeTemplate: StoreTemplateRecord;
    actor?: ResourceActor;
    documentTitleOverrides?: Record<string, string>;
  }) {
    let filePurpose = await filePurposeService.ensureGenericFilePurpose();
    let sortedItems = [...d.storeTemplate.items].sort((a, b) => {
      if (a.kind === b.kind) return a.path.localeCompare(b.path);
      if (a.kind === 'directory') return -1;
      if (b.kind === 'directory') return 1;
      return a.path.localeCompare(b.path);
    });

    for (let item of sortedItems) {
      if (item.kind === 'directory') {
        if (item.path === '/') {
          continue;
        }

        await storeItemMutationService.modifyStoreItems({
          project: d.project,
          instance: d.instance,
          store: d.store,
          operations: [
            {
              type: 'add',
              path: item.path
            }
          ]
        });

        continue;
      }

      let content = this.decodeStoreTemplateItemContent(item);
      let name = this.getStoreTemplateItemName(item.path);

      if (item.kind === 'document') {
        let documentContent = content.toString('utf8');
        let normalizedItemPath = normalizeStorePath({
          path: item.path,
          kind: 'file'
        });
        let titleOverride = d.documentTitleOverrides?.[normalizedItemPath.path];
        let title =
          titleOverride ?? item.title ?? this.inferMarkdownTitle(documentContent) ?? name;

        await documentService.createDocument({
          project: d.project,
          instance: d.instance,
          input: {
            title,
            content: titleOverride
              ? rewriteDocumentMarkdownTitle(documentContent, titleOverride)
              : documentContent,
            authorization: {
              type: 'privileged',
              resourceActor: d.actor
            },
            store: {
              id: d.store.id,
              path: item.path
            }
          }
        });

        continue;
      }

      let fileStoreId = `template_${generatePlainId(20)}`;
      let mimeType = item.mimeType ?? 'application/octet-stream';

      await getStorage().putObject(
        getCargoFilesBucketName(),
        fileStoreId,
        new Blob([content]),
        mimeType
      );

      await fileService.createFile({
        project: d.project,
        instance: d.instance,
        purpose: filePurpose.id,
        storeId: fileStoreId,
        input: {
          name,
          mimeType,
          size: content.length,
          title: name,
          authorization: {
            type: 'privileged',
            resourceActor: d.actor
          },
          store: {
            id: d.store.id,
            path: item.path
          }
        }
      });
    }
  }

  async createStore(d: {
    project: Project;
    instance: Instance;
    input: {
      id?: string;
      name: string;
      actor?: ResourceActor;
      access?: StoreAccess;
      cloneType?: StoreCloneType;
      parentStore?: Store;
      parentStoreTemplate?: Pick<StoreTemplateRecord, 'oid'>;
    };
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.input.actor
    });
    if (d.input.cloneType && !d.input.parentStore) {
      throw new ServiceError(
        badRequestError({
          message: 'Store clone type can only be set for cloned stores'
        })
      );
    }

    return await withTransaction(async db => {
      let storeIds = d.input.id ? { oid: getId('store').oid, id: d.input.id } : getId('store');
      let lastEditedAt = new Date();

      let createdStore = await db.store.create({
        data: {
          oid: storeIds.oid,
          id: storeIds.id,
          name: d.input.name,
          access: this.getTemplateLinkedStoreAccess({
            access: d.input.access,
            isTemplateLinked: !!d.input.parentStoreTemplate
          }),
          cloneType: d.input.parentStore ? (d.input.cloneType ?? 'sync_until_change') : null,
          itemCount: 0,
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          parentStoreOid: d.input.parentStore?.oid,
          parentStoreTemplateOid: d.input.parentStoreTemplate?.oid,
          createdByResourceActorOid: d.input.actor?.oid,
          lastEditedAt
        }
      });

      await storeItemMutationService.ensureStoreRootDirectory({
        project: d.project,
        instance: d.instance,
        store: createdStore
      });

      if (d.input.actor) {
        await storeAccessService.ensureActorStorePermissions({
          store: createdStore,
          actor: d.input.actor,
          permissions: [storeReadPermission, storeWritePermission]
        });
      }

      await enqueueStoreLifecycle({ storeId: createdStore.id, event: 'created' });

      return await db.store.findUniqueOrThrow({
        where: {
          id: createdStore.id
        }
      });
    });
  }

  async createStoreFromTemplate(
    d: { project: Project; instance: Instance } & StoreAccessInput & {
        input: {
          templateId: string;
          id?: string;
          name: string;
          actor?: ResourceActor;
          access?: StoreAccess;
          documentTitleOverrides?: Record<string, string>;
        };
      }
  ) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.input.actor
    });
    let storeTemplate = await storeTemplateService.getStoreTemplateByIdUnsafe({
      storeTemplateId: d.input.templateId
    });

    this.assertStoreTemplateCloneScope({
      project: d.project,
      instance: d.instance,
      storeTemplate
    });

    if (storeTemplate.sourceStore?.id) {
      let sourceStore = await this.getStoreRecord({
        project: d.project,
        instance: d.instance,
        storeId: storeTemplate.sourceStore.id
      });

      return await this.cloneStore({
        project: d.project,
        instance: d.instance,
        store: sourceStore,
        actor: d.input.actor,
        authorization: d.authorization,
        input: {
          id: d.input.id,
          name: d.input.name,
          access: d.input.access,
          cloneType: 'duplicate',
          parentStoreTemplate: storeTemplate,
          documentTitleOverrides: d.input.documentTitleOverrides
        },
        defaultPermissions: [storeReadPermission],
        overridePermissions: true
      });
    }

    let createdStore = await this.createStore({
      project: d.project,
      instance: d.instance,
      input: {
        id: d.input.id,
        name: d.input.name,
        access: d.input.access,
        actor: d.input.actor,
        parentStoreTemplate: storeTemplate
      }
    });

    await this.instantiateStandaloneTemplateItems({
      project: d.project,
      instance: d.instance,
      store: createdStore,
      storeTemplate,
      actor: d.input.actor,
      documentTitleOverrides: d.input.documentTitleOverrides
    });

    return createdStore;
  }

  async listStores(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        ids?: string[];
        parentStoreIds?: string[];
        parentStoreTemplateIds?: string[];
        createdByActorIds?: string[];
        createdAt?: DateFilter;
        updatedAt?: DateFilter;
        dirtyAt?: DateFilter;
        lastEditedAt?: DateFilter;
      }
  ) {
    let stores = await resolveStores(d, d.ids);
    let parentStores = await resolveStores(d, d.parentStoreIds);
    let parentStoreTemplates = await resolveStoreTemplates(d, d.parentStoreTemplateIds);
    let createdByActors = await resolveResourceActors(d, d.createdByActorIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let accessibleStoreOids =
          d.authorization.type === 'restricted'
            ? (
                await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
                  project: d.project,
                  instance: d.instance,
                  authorization: d.authorization,
                  defaultPermissions: d.defaultPermissions,
                  overridePermissions: d.overridePermissions,
                  requiredPermission: storeReadPermission
                })
              ).accessibleStoreOids
            : undefined;

        return await db.store.findMany({
          ...opts,
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            isTemplateBacking: false,
            AND: [
              stores ? { oid: stores.in } : undefined!,
              parentStores ? { parentStoreOid: parentStores.in } : undefined!,
              parentStoreTemplates
                ? { parentStoreTemplateOid: parentStoreTemplates.in }
                : undefined!,
              createdByActors ? { createdByResourceActorOid: createdByActors.in } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,
              d.dirtyAt ? { dirtyAt: normalizeDateFilter(d.dirtyAt) } : undefined!,
              d.lastEditedAt
                ? { lastEditedAt: normalizeDateFilter(d.lastEditedAt) }
                : undefined!
            ].filter(Boolean),
            oid: accessibleStoreOids ? { in: accessibleStoreOids } : undefined
          }
        });
      })
    );
  }

  async getStoreById(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        storeId: string;
      }
  ) {
    let store = await this.getStoreRecord(d);
    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return store;
  }

  async getStorePermissions(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        store: Pick<Store, 'oid' | 'id' | 'isReadOnly'>;
      }
  ) {
    return await storeAccessService.getStorePermissions({
      project: d.project,
      instance: d.instance,
      store: d.store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async updateStore(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        store: Store;
        input: {
          name?: string;
          access?: StoreAccess;
        };
      }
  ) {
    this.assertStoreWritable({
      store: d.store
    });

    if (d.input.name === undefined && d.input.access === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one store field must be updated'
        })
      );
    }

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await withTransaction(async db => {
      let lastEditedAt = new Date();
      let access =
        d.input.access === undefined
          ? undefined
          : this.getTemplateLinkedStoreAccess({
              access: d.input.access,
              isTemplateLinked: await this.isTemplateLinkedStore(d.store)
            });

      let updatedStore = await db.store.update({
        where: {
          id: d.store.id
        },
        data: {
          name: d.input.name,
          access
        }
      });

      await storeVersionService.touchStoreLastEditedAt({
        storeOid: d.store.oid,
        at: lastEditedAt
      });

      await enqueueStoreLifecycle({ storeId: d.store.id, event: 'updated' });

      return updatedStore;
    });
  }

  async cloneStore(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        store: Store;
        input: {
          id?: string;
          name?: string;
          access?: StoreAccess;
          cloneType?: StoreCloneType;
          parentStoreTemplate?: Pick<StoreTemplateRecord, 'oid'>;
          documentTitleOverrides?: Record<string, string>;
        };
      }
  ) {
    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return await withTransaction(async db => {
      let cloneType = d.input.cloneType ?? 'sync_until_change';
      let clonedStore = await this.createStore({
        project: d.project,
        instance: d.instance,
        input: {
          id: d.input.id,
          name: d.input.name ?? d.store.name,
          access: d.input.access ?? d.store.access,
          actor: d.actor,
          cloneType,
          parentStore: d.store,
          parentStoreTemplate: d.input.parentStoreTemplate
        }
      });

      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        include: storeItemInclude,
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (let item of items) {
        await this.cloneStoreItemIntoStore({
          project: d.project,
          instance: d.instance,
          targetStore: clonedStore,
          item,
          actor: d.actor,
          authorization: d.authorization,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions,
          cloneType,
          documentTitleOverrides: d.input.documentTitleOverrides
        });
      }

      await storeVersionService.markStoreDirtyIfNeeded({
        storeOid: clonedStore.oid
      });

      return await db.store.findUniqueOrThrow({
        where: {
          id: clonedStore.id
        }
      });
    });
  }

  async deleteStore(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        store: Store;
        allowLinkedSkillDelete?: boolean;
        allowLinkedStoreTemplateDelete?: boolean;
      }
  ) {
    this.assertStoreWritable({
      store: d.store
    });

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    if (!d.allowLinkedSkillDelete) {
      let linkedSkill = await db.skill.findFirst({
        where: {
          storeOid: d.store.oid
        },
        select: {
          id: true
        }
      });

      if (linkedSkill) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete store: it is linked to a skill'
          })
        );
      }
    }

    if (!d.allowLinkedStoreTemplateDelete) {
      let linkedStoreTemplate = d.store.parentStoreTemplateOid
        ? { id: d.store.id }
        : await db.storeTemplate.findFirst({
            where: {
              sourceStoreOid: d.store.oid
            },
            select: {
              id: true
            }
          });

      if (linkedStoreTemplate) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete store: it is linked to a store template'
          })
        );
      }
    }

    let { deletedStore, fileReferenceIds } = await withTransaction(async db => {
      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        select: {
          reference: {
            select: {
              id: true
            }
          }
        }
      });

      let deletedStore = await db.store.delete({
        where: {
          id: d.store.id
        }
      });

      await enqueueStoreLifecycle({ storeId: deletedStore.id, event: 'archived' });

      return {
        deletedStore,
        fileReferenceIds: items
          .map(item => item.reference?.id)
          .filter((id): id is string => !!id)
      };
    });

    if (fileReferenceIds.length > 0) {
      await storeCleanupManyQueue.add({
        fileReferenceIds
      });
    }

    return deletedStore;
  }

  async modifyStoreItems(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        store: Store;
        operations: StoreItemOperationInput[];
      }
  ) {
    this.assertStoreWritable({
      store: d.store
    });

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.store,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await storeItemMutationService.modifyStoreItems({
      project: d.project,
      instance: d.instance,
      store: d.store,
      operations: d.operations,
      actor: d.actor
    });
  }

  private async cloneStoreItemIntoStore(
    d: { project: Project; instance: Instance } & StoreServiceAccessInput & {
        targetStore: Store;
        item: StoreItemRecord;
        cloneType: StoreCloneType;
        documentTitleOverrides?: Record<string, string>;
      }
  ) {
    return await withTransaction(async db => {
      let normalizedItemPath = normalizeStorePath({
        path: d.item.path,
        kind: d.item.kind === 'directory' ? 'directory' : 'file'
      });

      if (d.item.kind === 'directory') {
        if (normalizedItemPath.path === '/') {
          return;
        }

        let sourceDirectory = await db.storeDirectory.findFirst({
          where: {
            storeOid: d.item.storeOid,
            path: normalizedItemPath.path
          }
        });

        if (sourceDirectory && !sourceDirectory.isAutoCreated) {
          await storeItemMutationService.modifyStoreItems({
            project: d.project,
            instance: d.instance,
            store: d.targetStore,
            operations: [
              {
                type: 'add',
                path: normalizedItemPath.path
              }
            ],
            actor: d.actor
          });
        }

        return;
      }

      if (d.item.document) {
        let titleOverride = d.documentTitleOverrides?.[normalizedItemPath.path];
        let sourceDocument = await db.document.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            id: d.item.document.id
          },
          include: documentInclude
        });

        if (!sourceDocument) {
          throw new ServiceError(notFoundError('document', d.item.document.id));
        }

        let clonedDocument = await documentService.cloneDocument({
          project: d.project,
          instance: d.instance,
          document: sourceDocument,
          input: {
            title: titleOverride,
            cloneType: d.cloneType,
            rewriteContentTitle: titleOverride !== undefined,
            authorization: {
              type: 'privileged',
              resourceActor: d.actor
            },
            creatorActor: d.actor
          }
        });

        await storeItemMutationService.attachTargetToStore({
          project: d.project,
          instance: d.instance,
          store: d.targetStore,
          path: normalizedItemPath.path,
          target: {
            file: clonedDocument.file,
            document: {
              oid: clonedDocument.oid,
              id: clonedDocument.id
            }
          },
          actor: d.actor
        });

        return;
      }

      if (!d.item.file) {
        throw new ServiceError(notFoundError('file', d.item.id));
      }

      await storeItemMutationService.attachTargetToStore({
        project: d.project,
        instance: d.instance,
        store: d.targetStore,
        path: normalizedItemPath.path,
        target: {
          file: d.item.file,
          document: null
        },
        actor: d.actor
      });
    });
  }
}

export let storeService = Service.create(
  'cargoStoreService',
  () => new StoreServiceImpl()
).build();
