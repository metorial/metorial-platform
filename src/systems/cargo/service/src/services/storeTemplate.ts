import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { normalizeStorePath } from '../lib/storePath';

export type StoreTemplateScope = {
  tenant?: { oid: bigint; id: string };
  environment?: { oid: bigint; id: string };
};

export type RequiredStoreTemplateScope = {
  tenant: NonNullable<StoreTemplateScope['tenant']>;
  environment: NonNullable<StoreTemplateScope['environment']>;
};

export type StoreTemplateItemInput = {
  path: string;
  type: 'file' | 'document' | 'directory';
  content?: string;
  encoding?: 'utf-8' | 'base64';
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
  tenant: {
    select: {
      id: true
    }
  },
  environment: {
    select: {
      id: true
    }
  },
  sourceStore: {
    select: {
      id: true
    }
  },
  items: {
    select: {
      id: true
    }
  }
} satisfies Prisma.StoreTemplateInclude;

let storeTemplateInclude = {
  tenant: {
    select: {
      id: true
    }
  },
  environment: {
    select: {
      id: true
    }
  },
  sourceStore: {
    select: {
      id: true
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

type SourceStoreRecord = Prisma.StoreGetPayload<{
  include: {
    tenant: {
      select: {
        oid: true;
        id: true;
      };
    };
    environment: {
      select: {
        oid: true;
        id: true;
      };
    };
  };
}>;

type NormalizedStoreTemplateItem = {
  kind: 'file' | 'document' | 'directory';
  path: string;
  content?: string;
  encoding?: 'utf_8' | 'base64';
};

class StoreTemplateServiceImpl {
  private assertValidScope(d: StoreTemplateScope) {
    if (d.environment && !d.tenant) {
      throw new ServiceError(
        badRequestError({
          message: 'tenantId is required when environmentId is provided'
        })
      );
    }
  }

  private async getSourceStoreRecord(d: { storeId: string }) {
    let store = await db.store.findFirst({
      where: {
        id: d.storeId
      },
      include: {
        tenant: {
          select: {
            oid: true,
            id: true
          }
        },
        environment: {
          select: {
            oid: true,
            id: true
          }
        }
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

  private assertRequiredScope(d: StoreTemplateScope): asserts d is RequiredStoreTemplateScope {
    this.assertValidScope(d);

    if (!d.tenant || !d.environment) {
      throw new ServiceError(
        badRequestError({
          message: 'tenantId and environmentId are required'
        })
      );
    }
  }

  private getReadableScopeWhere(d: {
    tenant: { oid: bigint };
    environment: { oid: bigint };
  }): Prisma.StoreTemplateWhereInput {
    return {
      OR: [
        {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        {
          tenantOid: null,
          environmentOid: null
        }
      ]
    };
  }

  private assertMatchingScope(d: {
    storeTemplate: Pick<StoreTemplateRecord, 'id' | 'tenant' | 'environment'>;
    tenant: { oid: bigint; id: string };
    environment: { oid: bigint; id: string };
  }) {
    if (
      d.storeTemplate.tenant?.id !== d.tenant.id ||
      d.storeTemplate.environment?.id !== d.environment.id
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Store template updates and deletes are only allowed within the matching tenant and environment'
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

  private normalizeStandaloneItem(d: {
    item: StoreTemplateItemInput;
  }): NormalizedStoreTemplateItem {
    let path = normalizeStorePath({
      path: d.item.path,
      kind: d.item.type === 'directory' ? 'directory' : 'file'
    }).path;

    if (d.item.type === 'directory') {
      if (d.item.content !== undefined || d.item.encoding !== undefined) {
        throw new ServiceError(
          badRequestError({
            message: 'Directory template items cannot include content or encoding'
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

    return {
      kind: d.item.type,
      path,
      content: d.item.content,
      encoding: d.item.encoding === 'utf-8' ? 'utf_8' : 'base64'
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
        encoding: item.encoding ?? null
      };
    });
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

    let sourceStore: SourceStoreRecord | undefined;
    let tenant = d.tenant;
    let environment = d.environment;
    let standaloneItems: NormalizedStoreTemplateItem[] | undefined;

    if (d.input.storeId) {
      sourceStore = await this.getSourceStoreRecord({
        storeId: d.input.storeId
      });

      if (tenant && tenant.oid !== sourceStore.tenantOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Store template tenant must match the linked store tenant'
          })
        );
      }

      if (environment && environment.oid !== sourceStore.environmentOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Store template environment must match the linked store environment'
          })
        );
      }

      tenant = tenant ?? sourceStore.tenant;
      environment = environment ?? sourceStore.environment;
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
          tenantOid: tenant?.oid ?? null,
          environmentOid: environment?.oid ?? null,
          sourceStoreOid: sourceStore?.oid ?? null,
          ...(standaloneItems
            ? {
                items: {
                  createMany: {
                    data: this.buildStandaloneTemplateItemCreateManyData({
                      items: standaloneItems
                    })
                  }
                }
              }
            : {})
        },
        include: storeTemplateInclude
      });

      return createdTemplate;
    });
  }

  async listStoreTemplates(d: RequiredStoreTemplateScope) {
    this.assertRequiredScope(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.storeTemplate.findMany({
            ...opts,
            where: this.getReadableScopeWhere(d),
            include: storeTemplateSummaryInclude
          })
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

        return storeTemplate;
      },
      { ifExists: true }
    );
  }

  async getStoreTemplateByIdUnsafe(d: { storeTemplateId: string }) {
    return await this.getStoreTemplateRecord(d);
  }

  async updateStoreTemplate(d: {
    storeTemplate: StoreTemplateRecord;
    input: StoreTemplateUpdateInput;
    tenant?: { oid: bigint; id: string };
    environment?: { oid: bigint; id: string };
    skipScopeCheck?: true;
  }) {
    if (!d.skipScopeCheck) {
      this.assertRequiredScope(d);
      this.assertMatchingScope({
        storeTemplate: d.storeTemplate,
        tenant: d.tenant,
        environment: d.environment
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

      if (standaloneItems) {
        await db.storeTemplateItem.deleteMany({
          where: {
            storeTemplateOid: d.storeTemplate.oid
          }
        });

        if (standaloneItems.length > 0) {
          await db.storeTemplateItem.createMany({
            data: this.buildStandaloneTemplateItemCreateManyData({
              items: standaloneItems
            }).map(item => ({
              ...item,
              storeTemplateOid: d.storeTemplate.oid
            }))
          });
        }
      }

      return await db.storeTemplate.findUniqueOrThrow({
        where: {
          id: d.storeTemplate.id
        },
        include: storeTemplateInclude
      });
    });
  }

  async deleteStoreTemplate(d: {
    storeTemplateId: string;
    tenant?: { oid: bigint; id: string };
    environment?: { oid: bigint; id: string };
    skipScopeCheck?: true;
  }) {
    if (!d.skipScopeCheck) {
      this.assertRequiredScope(d);
    }

    let storeTemplate = d.skipScopeCheck
      ? await this.getStoreTemplateRecord(d)
      : await this.getStoreTemplateById({
          tenant: d.tenant!,
          environment: d.environment!,
          storeTemplateId: d.storeTemplateId
        });

    if (!d.skipScopeCheck && d.tenant && d.environment) {
      this.assertMatchingScope({
        storeTemplate,
        tenant: d.tenant,
        environment: d.environment
      });
    }

    await db.storeTemplate.delete({
      where: {
        id: d.storeTemplateId
      }
    });

    return storeTemplate;
  }
}

export let storeTemplateService = Service.create(
  'cargoStoreTemplateService',
  () => new StoreTemplateServiceImpl()
).build();
