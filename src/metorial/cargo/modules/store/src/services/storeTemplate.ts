import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type CargoScope,
  type DateFilter,
  normalizeDateFilter,
  resolveStores,
  resolveStoreTemplates
} from '@metorial/cargo-list-utils';
import type { Prisma, Store } from '@metorial/db';
import { addAfterTransactionHook, db, withTransaction } from '@metorial/db';
import { normalizeStorePath } from '../lib/storePath';
import {
  storeTemplateItemsUpdatedQueue,
  storeTemplateItemUpdatedQueue
} from '../queues/storeTemplateSync';

export type StoreTemplateScope = Partial<CargoScope>;

export type RequiredStoreTemplateScope = CargoScope;

export type StoreTemplateItemInput = {
  path: string;
  type: 'file' | 'document' | 'directory';
  content?: string;
  encoding?: 'utf-8' | 'base64';
  mimeType?: string;
  title?: string;
};

export type StoreTemplateCreateInput = {
  id?: string;
  name: string;
  storeId?: string;
  items?: StoreTemplateItemInput[];
};

export type StoreTemplateUpdateInput = {
  name?: string;
  items?: StoreTemplateItemInput[];
};

let storeTemplateSummaryInclude = {
  sourceStore: {
    select: {
      id: true
    }
  },
  backingStores: {
    select: {
      projectOid: true,
      instanceOid: true,
      store: {
        select: {
          id: true
        }
      }
    }
  },
  items: {
    select: {
      id: true
    }
  }
} satisfies Prisma.StoreTemplateInclude;

let storeTemplateInclude = {
  sourceStore: {
    select: {
      id: true
    }
  },
  backingStores: {
    select: {
      projectOid: true,
      instanceOid: true,
      store: {
        select: {
          id: true
        }
      }
    }
  },
  items: {
    orderBy: [
      {
        path: 'asc'
      },
      {
        id: 'asc'
      }
    ]
  }
} satisfies Prisma.StoreTemplateInclude;

export type StoreTemplateSummaryRecord = Prisma.StoreTemplateGetPayload<{
  include: typeof storeTemplateSummaryInclude;
}>;

export type StoreTemplateRecord = Prisma.StoreTemplateGetPayload<{
  include: typeof storeTemplateInclude;
}>;

export type StoreTemplateWithScopedStoreId<T> = T & {
  storeId?: string;
};

type NormalizedStoreTemplateItem = {
  kind: 'file' | 'document' | 'directory';
  path: string;
  content?: string;
  encoding?: 'utf_8' | 'base64';
  mimeType?: string;
  title?: string;
};

class StoreTemplateServiceImpl {
  private assertValidScope(d: StoreTemplateScope) {
    if (d.instance && !d.project) {
      throw new ServiceError(
        badRequestError({
          message: 'projectId is required when instanceId is provided'
        })
      );
    }
  }

  private async getSourceStoreRecord(d: { storeId: string }) {
    let store = await db.store.findFirst({
      where: {
        id: d.storeId
      }
    });

    if (!store) {
      throw new ServiceError(notFoundError('store', d.storeId));
    }

    return store;
  }

  private async getStoreTemplateRecord(d: { storeTemplateId: string }) {
    return await withTransaction(
      async db => {
        let storeTemplate = await db.storeTemplate.findFirst({
          where: {
            id: d.storeTemplateId
          },
          include: storeTemplateInclude
        });

        if (!storeTemplate) {
          throw new ServiceError(notFoundError('storeTemplate', d.storeTemplateId));
        }

        return storeTemplate;
      },
      { ifExists: true }
    );
  }

  private assertRequiredScope<T extends StoreTemplateScope>(
    d: T
  ): asserts d is T & RequiredStoreTemplateScope {
    this.assertValidScope(d);

    if (!d.project || !d.instance) {
      throw new ServiceError(
        badRequestError({
          message: 'projectId and instanceId are required'
        })
      );
    }
  }

  private getReadableScopeWhere(d: {
    project: { oid: bigint };
    instance: { oid: bigint };
  }): Prisma.StoreTemplateWhereInput {
    return {
      OR: [
        {
          projectOid: d.project.oid,
          instanceOid: d.instance.oid
        },
        {
          projectOid: null,
          instanceOid: null
        }
      ]
    };
  }

  private assertMatchingScope(d: {
    storeTemplate: Pick<StoreTemplateRecord, 'id' | 'projectOid' | 'instanceOid'>;
    project: { oid: bigint };
    instance: { oid: bigint };
  }) {
    if (
      d.storeTemplate.projectOid !== d.project.oid ||
      d.storeTemplate.instanceOid !== d.instance.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Store template updates and deletes are only allowed within the matching project and instance'
        })
      );
    }
  }

  private assertStandaloneTemplate(storeTemplate: Pick<StoreTemplateRecord, 'id' | 'type'>) {
    if (storeTemplate.type !== 'standalone') {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${storeTemplate.id} does not support standalone item updates`
        })
      );
    }
  }

  private normalizeDocumentTitle(title: string | undefined) {
    if (title === undefined) return undefined;

    let normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new ServiceError(
        badRequestError({
          message: 'Document template item title cannot be empty'
        })
      );
    }

    return normalizedTitle;
  }

  private normalizeStandaloneItem(d: {
    item: StoreTemplateItemInput;
  }): NormalizedStoreTemplateItem {
    let path = normalizeStorePath({
      path: d.item.path,
      kind: d.item.type === 'directory' ? 'directory' : 'file'
    }).path;

    if (d.item.type === 'directory') {
      if (
        d.item.content !== undefined ||
        d.item.encoding !== undefined ||
        d.item.mimeType !== undefined ||
        d.item.title !== undefined
      ) {
        throw new ServiceError(
          badRequestError({
            message:
              'Directory template items cannot include content, encoding, mimeType, or title'
          })
        );
      }

      return {
        kind: 'directory',
        path
      };
    }

    if (d.item.content === undefined || d.item.encoding === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'File and document template items require content and encoding'
        })
      );
    }

    if (d.item.type !== 'file' && d.item.mimeType !== undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'Only file template items can include mimeType'
        })
      );
    }

    if (d.item.type !== 'document' && d.item.title !== undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'Only document template items can include title'
        })
      );
    }

    return {
      kind: d.item.type,
      path,
      content: d.item.content,
      encoding: d.item.encoding === 'utf-8' ? 'utf_8' : 'base64',
      mimeType: d.item.mimeType,
      title: this.normalizeDocumentTitle(d.item.title)
    };
  }

  private normalizeStandaloneItems(d: { items: StoreTemplateItemInput[] }) {
    let seenPaths = new Set<string>();

    return d.items.map(item => {
      let normalized = this.normalizeStandaloneItem({ item });

      if (seenPaths.has(normalized.path)) {
        throw new ServiceError(
          badRequestError({
            message: `Store template item path already exists: ${normalized.path}`
          })
        );
      }

      seenPaths.add(normalized.path);

      return normalized;
    });
  }

  private buildStandaloneTemplateItemCreateManyData(d: {
    items: NormalizedStoreTemplateItem[];
  }) {
    return d.items.map(item => {
      let itemIds = getId('storeTemplateItem');

      return {
        oid: itemIds.oid,
        id: itemIds.id,
        kind: item.kind,
        path: item.path,
        content: item.content ?? null,
        encoding: item.encoding ?? null,
        mimeType: item.mimeType ?? null,
        title: item.title ?? null
      };
    });
  }

  private sameStandaloneItem(
    left: StoreTemplateRecord['items'][number],
    right: NormalizedStoreTemplateItem
  ) {
    return (
      left.kind === right.kind &&
      left.content === (right.content ?? null) &&
      left.encoding === (right.encoding ?? null) &&
      left.mimeType === (right.mimeType ?? null) &&
      left.title === (right.title ?? null)
    );
  }

  private async enqueueTemplateItemHashUpdates(itemIds: string[]) {
    if (itemIds.length === 0) return;

    await storeTemplateItemUpdatedQueue.addMany(
      itemIds.map(storeTemplateItemId => ({
        storeTemplateItemId
      }))
    );
  }

  private withScopedStoreId<T extends StoreTemplateSummaryRecord | StoreTemplateRecord>(
    storeTemplate: T,
    scope?: CargoScope
  ): StoreTemplateWithScopedStoreId<T> {
    if (storeTemplate.sourceStore?.id) {
      return {
        ...storeTemplate,
        storeId: storeTemplate.sourceStore.id
      };
    }

    if (!scope) return storeTemplate;

    let backing = storeTemplate.backingStores.find(
      backing =>
        backing.projectOid === scope.project.oid && backing.instanceOid === scope.instance.oid
    );

    return {
      ...storeTemplate,
      storeId: backing?.store.id
    };
  }

  async createStoreTemplate(
    d: StoreTemplateScope & {
      input: StoreTemplateCreateInput;
    }
  ) {
    this.assertValidScope(d);

    if (!d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Store template name cannot be empty'
        })
      );
    }

    let hasSourceStore = !!d.input.storeId;
    let hasStandaloneItems = d.input.items !== undefined;

    if (hasSourceStore === hasStandaloneItems) {
      throw new ServiceError(
        badRequestError({
          message: 'Provide either storeId or items when creating a store template'
        })
      );
    }

    let sourceStore: Store | undefined;
    let projectOid = d.project?.oid ?? null;
    let instanceOid = d.instance?.oid ?? null;
    let standaloneItems: NormalizedStoreTemplateItem[] | undefined;

    if (d.input.storeId) {
      sourceStore = await this.getSourceStoreRecord({
        storeId: d.input.storeId
      });

      if (projectOid && sourceStore.projectOid && projectOid !== sourceStore.projectOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Store template project must match the linked store project'
          })
        );
      }

      if (instanceOid && sourceStore.instanceOid && instanceOid !== sourceStore.instanceOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Store template instance must match the linked store instance'
          })
        );
      }

      projectOid = projectOid ?? sourceStore.projectOid;
      instanceOid = instanceOid ?? sourceStore.instanceOid;
    } else {
      standaloneItems = this.normalizeStandaloneItems({
        items: d.input.items ?? []
      });
    }

    return await withTransaction(async db => {
      let templateIds = d.input.id
        ? { oid: getId('storeTemplate').oid, id: d.input.id }
        : getId('storeTemplate');

      let createdTemplate = await db.storeTemplate.create({
        data: {
          oid: templateIds.oid,
          id: templateIds.id,
          name: d.input.name,
          type: sourceStore ? 'linked_store' : 'standalone',
          projectOid,
          instanceOid,
          sourceStoreOid: sourceStore?.oid ?? null,
          items: standaloneItems
            ? {
                createMany: {
                  data: this.buildStandaloneTemplateItemCreateManyData({
                    items: standaloneItems
                  })
                }
              }
            : undefined
        },
        include: storeTemplateInclude
      });

      if (sourceStore?.access === 'private') {
        await db.store.update({
          where: {
            id: sourceStore.id
          },
          data: {
            access: 'public_read'
          }
        });
      }

      if (createdTemplate.type === 'standalone') {
        let itemIds = createdTemplate.items.map(item => item.id);
        await addAfterTransactionHook(async () => {
          await this.enqueueTemplateItemHashUpdates(itemIds);
          if (itemIds.length === 0) {
            await storeTemplateItemsUpdatedQueue.add({
              storeTemplateId: createdTemplate.id,
              forceFullReconcile: true
            });
          }
        });
      }

      return createdTemplate;
    });
  }

  async listStoreTemplates(
    d: RequiredStoreTemplateScope & {
      ids?: string[];
      sourceStoreIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    this.assertRequiredScope(d);
    let storeTemplates = await resolveStoreTemplates(d, d.ids);
    let sourceStores = await resolveStores(d, d.sourceStoreIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        (
          await db.storeTemplate.findMany({
            ...opts,
            where: {
              ...this.getReadableScopeWhere(d),
              oid: storeTemplates ? storeTemplates.in : undefined,
              sourceStoreOid: sourceStores ? sourceStores.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined
            },
            include: storeTemplateSummaryInclude
          })
        ).map(storeTemplate => this.withScopedStoreId(storeTemplate, d))
      )
    );
  }

  async getStoreTemplateById(
    d: RequiredStoreTemplateScope & {
      storeTemplateId: string;
    }
  ) {
    this.assertRequiredScope(d);

    return await withTransaction(
      async db => {
        let storeTemplate = await db.storeTemplate.findFirst({
          where: {
            id: d.storeTemplateId,
            ...this.getReadableScopeWhere(d)
          },
          include: storeTemplateInclude
        });

        if (!storeTemplate) {
          throw new ServiceError(notFoundError('storeTemplate', d.storeTemplateId));
        }

        return this.withScopedStoreId(storeTemplate, d);
      },
      { ifExists: true }
    );
  }

  async getStoreTemplateByIdUnsafe(d: { storeTemplateId: string }) {
    return await this.getStoreTemplateRecord(d);
  }

  async updateStoreTemplate(
    d: StoreTemplateScope & {
      storeTemplate: StoreTemplateRecord;
      input: StoreTemplateUpdateInput;
      skipScopeCheck?: true;
    }
  ) {
    if (!d.skipScopeCheck) {
      this.assertRequiredScope(d);
      this.assertMatchingScope({
        storeTemplate: d.storeTemplate,
        project: d.project,
        instance: d.instance
      });
    }

    if (d.input.name === undefined && d.input.items === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one store template field must be updated'
        })
      );
    }

    if (d.input.name !== undefined && !d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Store template name cannot be empty'
        })
      );
    }

    let standaloneItems =
      d.input.items !== undefined
        ? this.normalizeStandaloneItems({
            items: d.input.items
          })
        : undefined;

    if (standaloneItems) {
      this.assertStandaloneTemplate(d.storeTemplate);
    }

    return await withTransaction(async db => {
      await db.storeTemplate.update({
        where: {
          id: d.storeTemplate.id
        },
        data: {
          name: d.input.name
        }
      });

      let updatedItemIds: string[] = [];
      let forceFullReconcile = d.input.name !== undefined;

      if (standaloneItems) {
        let existingByPath = new Map(d.storeTemplate.items.map(item => [item.path, item]));
        let nextPaths = new Set(standaloneItems.map(item => item.path));
        let removedItems = d.storeTemplate.items.filter(item => !nextPaths.has(item.path));

        if (removedItems.length > 0) {
          forceFullReconcile = true;
          await db.storeTemplateItem.deleteMany({
            where: {
              id: {
                in: removedItems.map(item => item.id)
              }
            }
          });
        }

        for (let item of standaloneItems) {
          let existing = existingByPath.get(item.path);

          if (!existing) {
            let [createdItem] = await db.storeTemplateItem.createManyAndReturn({
              data: this.buildStandaloneTemplateItemCreateManyData({
                items: [item]
              }).map(item => ({
                ...item,
                storeTemplateOid: d.storeTemplate.oid
              }))
            });
            if (createdItem) updatedItemIds.push(createdItem.id);
            continue;
          }

          if (this.sameStandaloneItem(existing, item)) continue;

          let updatedItem = await db.storeTemplateItem.update({
            where: {
              id: existing.id
            },
            data: {
              kind: item.kind,
              path: item.path,
              content: item.content ?? null,
              encoding: item.encoding ?? null,
              mimeType: item.mimeType ?? null,
              title: item.title ?? null,
              hash: null,
              contentHash: null,
              fileStoreId: null,
              contentByteSize: null
            }
          });
          updatedItemIds.push(updatedItem.id);
        }
      }

      let updatedTemplate = await db.storeTemplate.findUniqueOrThrow({
        where: {
          id: d.storeTemplate.id
        },
        include: storeTemplateInclude
      });

      if (updatedTemplate.type === 'standalone') {
        await addAfterTransactionHook(async () => {
          await this.enqueueTemplateItemHashUpdates(updatedItemIds);
          if (forceFullReconcile || (standaloneItems && updatedItemIds.length === 0)) {
            await storeTemplateItemsUpdatedQueue.add({
              storeTemplateId: updatedTemplate.id,
              updatedItemIds: updatedItemIds.length > 0 ? updatedItemIds : undefined,
              forceFullReconcile
            });
          }
        });
      }

      return this.withScopedStoreId(
        updatedTemplate,
        d.project && d.instance
          ? {
              project: d.project,
              instance: d.instance
            }
          : undefined
      );
    });
  }

  async deleteStoreTemplate(
    d: StoreTemplateScope & {
      storeTemplateId: string;
      skipScopeCheck?: true;
    }
  ) {
    if (!d.skipScopeCheck) {
      this.assertRequiredScope(d);
    }

    let storeTemplate = d.skipScopeCheck
      ? await this.getStoreTemplateRecord(d)
      : await this.getStoreTemplateById({
          project: d.project!,
          instance: d.instance!,
          storeTemplateId: d.storeTemplateId
        });

    if (!d.skipScopeCheck && d.project && d.instance) {
      this.assertMatchingScope({
        storeTemplate,
        project: d.project,
        instance: d.instance
      });
    }

    await withTransaction(async db => {
      let backings = await db.storeTemplateBacking.findMany({
        where: {
          storeTemplateOid: storeTemplate.oid
        },
        select: {
          storeOid: true
        }
      });

      if (backings.length > 0) {
        await db.store.deleteMany({
          where: {
            oid: {
              in: backings.map(backing => backing.storeOid)
            },
            isTemplateBacking: true
          }
        });
      }

      await db.storeTemplate.delete({
        where: {
          id: d.storeTemplateId
        }
      });
    });

    return storeTemplate;
  }
}

export let storeTemplateService = Service.create(
  'cargoStoreTemplateService',
  () => new StoreTemplateServiceImpl()
).build();
