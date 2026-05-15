import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Instance,
  type Organization,
  type SkillMarketplace,
  type SkillPlugin
} from '@metorial/db';
import {
  cargo,
  type CargoSkillMarketplace,
  type CargoSkillMarketplacePlugin,
  type CargoSkillPlugin
} from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

type SkillMarketplaceAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

type SkillMarketplaceInput = {
  name?: string;
  description?: string | null;
  slug?: string;
  providerOverrides?: Record<string, any> | null;
  imageFileId?: string | null;
  skillConfigurationId?: string | null;
};

type ListSkillMarketplacesInput = SkillMarketplaceAccessInput & {
  ids?: string[];
  statuses?: Array<'active' | 'archived' | 'deleted'>;
  skillConfigurationIds?: string[];
  slug?: string;
  createdAt?: any;
  updatedAt?: any;
};

type BackingOwner = {
  organization: Organization;
  instance: Instance;
};

type EnrichedSkillMarketplacePlugin = Omit<CargoSkillMarketplacePlugin, 'skillPlugin'> & {
  skillPlugin: CargoSkillPlugin & { backing: SkillPlugin };
};

export type EnrichedCargoSkillMarketplace = Omit<CargoSkillMarketplace, 'plugins'> & {
  backing: SkillMarketplace;
  plugins: EnrichedSkillMarketplacePlugin[];
};

let statusFromCargo = (status: string) =>
  status == 'archived'
    ? ('archived' as const)
    : status == 'deleted'
      ? ('deleted' as const)
      : ('active' as const);

let uniqueById = <T extends { id: string }>(items: T[]) => [
  ...new Map(items.map(item => [item.id, item])).values()
];

class SkillMarketplaceServiceImpl {
  private getBackingOwner(owner: FileOwner): BackingOwner {
    if (owner.type != 'instance') {
      throw new ServiceError(notFoundError('skill.marketplace.owner'));
    }

    return {
      organization: owner.organization,
      instance: owner.instance
    };
  }

  private async syncSkillMarketplaceBackings(d: {
    owner: BackingOwner;
    skillMarketplaces: CargoSkillMarketplace[];
  }) {
    let skillMarketplaces = uniqueById(d.skillMarketplaces);
    if (!skillMarketplaces.length) return new Map<string, SkillMarketplace>();

    let skillMarketplaceIds = skillMarketplaces.map(skillMarketplace => skillMarketplace.id);
    let existing = await db.skillMarketplace.findMany({
      where: {
        instanceOid: d.owner.instance.oid,
        id: {
          in: skillMarketplaceIds
        }
      }
    });
    let existingByCargoId = new Map(
      existing.map(skillMarketplace => [skillMarketplace.id, skillMarketplace])
    );
    let missing = skillMarketplaces.filter(
      skillMarketplace => !existingByCargoId.has(skillMarketplace.id)
    );

    if (missing.length) {
      await db.skillMarketplace.createMany({
        data: missing.map(skillMarketplace => ({
          id: skillMarketplace.id,
          status: statusFromCargo(skillMarketplace.status),
          organizationOid: d.owner.organization.oid,
          instanceOid: d.owner.instance.oid
        })),
        skipDuplicates: true
      });
    }

    for (let status of ['active', 'archived', 'deleted'] as const) {
      let ids = skillMarketplaces
        .filter(skillMarketplace => statusFromCargo(skillMarketplace.status) == status)
        .map(skillMarketplace => skillMarketplace.id);
      if (!ids.length) continue;

      await db.skillMarketplace.updateMany({
        where: {
          instanceOid: d.owner.instance.oid,
          id: {
            in: ids
          },
          status: {
            not: status
          }
        },
        data: {
          status
        }
      });
    }

    let backings = await db.skillMarketplace.findMany({
      where: {
        instanceOid: d.owner.instance.oid,
        id: {
          in: skillMarketplaceIds
        }
      }
    });

    return new Map(backings.map(backing => [backing.id, backing]));
  }

  private async syncSkillPluginBackings(d: {
    owner: BackingOwner;
    skillPlugins: CargoSkillPlugin[];
  }) {
    let skillPlugins = uniqueById(d.skillPlugins);
    if (!skillPlugins.length) return new Map<string, SkillPlugin>();

    let skillPluginIds = skillPlugins.map(skillPlugin => skillPlugin.id);
    let existing = await db.skillPlugin.findMany({
      where: {
        instanceOid: d.owner.instance.oid,
        id: {
          in: skillPluginIds
        }
      }
    });
    let existingByCargoId = new Map(
      existing.map(skillPlugin => [skillPlugin.id, skillPlugin])
    );
    let missing = skillPlugins.filter(skillPlugin => !existingByCargoId.has(skillPlugin.id));

    if (missing.length) {
      await db.skillPlugin.createMany({
        data: missing.map(skillPlugin => ({
          id: skillPlugin.id,
          status: statusFromCargo(skillPlugin.status),
          organizationOid: d.owner.organization.oid,
          instanceOid: d.owner.instance.oid
        })),
        skipDuplicates: true
      });
    }

    for (let status of ['active', 'archived', 'deleted'] as const) {
      let ids = skillPlugins
        .filter(skillPlugin => statusFromCargo(skillPlugin.status) == status)
        .map(skillPlugin => skillPlugin.id);
      if (!ids.length) continue;

      await db.skillPlugin.updateMany({
        where: {
          instanceOid: d.owner.instance.oid,
          id: {
            in: ids
          },
          status: {
            not: status
          }
        },
        data: {
          status
        }
      });
    }

    let backings = await db.skillPlugin.findMany({
      where: {
        instanceOid: d.owner.instance.oid,
        id: {
          in: skillPluginIds
        }
      }
    });

    return new Map(backings.map(backing => [backing.id, backing]));
  }

  async enrichSkillMarketplaces(d: {
    owner: FileOwner;
    skillMarketplaces: CargoSkillMarketplace[];
  }): Promise<EnrichedCargoSkillMarketplace[]> {
    let owner = this.getBackingOwner(d.owner);
    let nestedSkillPlugins = d.skillMarketplaces.flatMap(skillMarketplace =>
      (skillMarketplace.plugins ?? []).map(plugin => plugin.skillPlugin)
    );
    let [marketplaceBackingByCargoId, pluginBackingByCargoId] = await Promise.all([
      this.syncSkillMarketplaceBackings({
        owner,
        skillMarketplaces: d.skillMarketplaces
      }),
      this.syncSkillPluginBackings({
        owner,
        skillPlugins: nestedSkillPlugins
      })
    ]);

    return d.skillMarketplaces.map(skillMarketplace => ({
      ...skillMarketplace,
      plugins: (skillMarketplace.plugins ?? []).map(plugin => ({
        ...plugin,
        skillPlugin: {
          ...plugin.skillPlugin,
          backing: pluginBackingByCargoId.get(plugin.skillPlugin.id)!
        }
      })),
      backing: marketplaceBackingByCargoId.get(skillMarketplace.id)!
    }));
  }

  private async enrichSkillMarketplace(d: {
    owner: FileOwner;
    skillMarketplace: CargoSkillMarketplace;
  }): Promise<EnrichedCargoSkillMarketplace> {
    let [skillMarketplace] = await this.enrichSkillMarketplaces({
      owner: d.owner,
      skillMarketplaces: [d.skillMarketplace]
    });

    return skillMarketplace!;
  }

  async listSkillMarketplaces(d: ListSkillMarketplacesInput) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillMarketplace.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillMarketplaceIds: d.ids,
        statuses: d.statuses,
        skillConfigurationIds: d.skillConfigurationIds,
        slug: d.slug,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...input
      });

      return {
        items: await this.enrichSkillMarketplaces({
          owner: d.owner,
          skillMarketplaces: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillMarketplaceById(
    d: SkillMarketplaceAccessInput & {
      skillMarketplaceId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let owner = this.getBackingOwner(d.owner);
    let backing = await db.skillMarketplace.findFirst({
      where: {
        instanceOid: owner.instance.oid,
        id: d.skillMarketplaceId,
        status: { not: 'deleted' }
      }
    });
    if (!backing)
      throw new ServiceError(notFoundError('skill.marketplace', d.skillMarketplaceId));

    let skillMarketplace = await cargo.skillMarketplace.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: backing.id
    });

    return await this.enrichSkillMarketplace({
      owner: d.owner,
      skillMarketplace
    });
  }

  async createSkillMarketplace(
    d: SkillMarketplaceAccessInput & {
      input: SkillMarketplaceInput & { name: string };
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillMarketplace = await cargo.skillMarketplace.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      name: d.input.name,
      description: d.input.description,
      slug: d.input.slug,
      providerOverrides: d.input.providerOverrides,
      imageFileId: d.input.imageFileId,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return await this.enrichSkillMarketplace({ owner: d.owner, skillMarketplace });
  }

  async updateSkillMarketplace(
    d: SkillMarketplaceAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      input: SkillMarketplaceInput;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillMarketplace = await cargo.skillMarketplace.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      name: d.input.name,
      description: d.input.description,
      slug: d.input.slug,
      providerOverrides: d.input.providerOverrides,
      imageFileId: d.input.imageFileId,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return await this.enrichSkillMarketplace({ owner: d.owner, skillMarketplace });
  }

  async archiveSkillMarketplace(
    d: SkillMarketplaceAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillMarketplace = await cargo.skillMarketplace.archive({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id
    });

    return await this.enrichSkillMarketplace({ owner: d.owner, skillMarketplace });
  }

  async getSkillMarketplaceEditorUrl(
    d: SkillMarketplaceAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      isReadOnly?: boolean;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillMarketplace.getEditorUrl({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      isReadOnly: d.isReadOnly
    });
  }
}

export let skillMarketplaceService = Service.create(
  'fileSkillMarketplace',
  () => new SkillMarketplaceServiceImpl()
).build();
