import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Instance, type Organization, type SkillPlugin } from '@metorial/db';
import {
  cargo,
  type CargoSkillMarketplacePlugin,
  type CargoSkillPlugin,
  type CargoSkillPluginSkill
} from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import type { EnrichedCargoSkillMarketplace } from './skillMarketplace';

type SkillPluginAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

type SkillPluginInput = {
  name?: string;
  description?: string | null;
  longDescription?: string | null;
  category?: string | null;
  slug?: string;
  providerOverrides?: Record<string, any> | null;
  imageFileId?: string | null;
  skillConfigurationId?: string | null;
};

type SkillPluginSkillInput = {
  clientName?: string | null;
  clientDescription?: string | null;
  clientMetadata?: Record<string, any> | null;
  license?: string | null;
  compatibility?: string | null;
  skillConfigurationId?: string | null;
};

type BackingOwner = {
  organization: Organization;
  instance: Instance;
};

export type EnrichedCargoSkillPlugin = CargoSkillPlugin & {
  backing: SkillPlugin;
};

export type EnrichedCargoSkillMarketplacePlugin = Omit<
  CargoSkillMarketplacePlugin,
  'skillPlugin'
> & {
  skillPlugin?: EnrichedCargoSkillPlugin;
};

export type EnrichedCargoSkillPluginSkill = Omit<CargoSkillPluginSkill, 'skillPlugin'> & {
  skillPlugin?: EnrichedCargoSkillPlugin;
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

class SkillPluginServiceImpl {
  private getBackingOwner(owner: FileOwner): BackingOwner {
    if (owner.type != 'instance') {
      throw new ServiceError(notFoundError('skill.plugin.owner'));
    }

    return {
      organization: owner.organization,
      instance: owner.instance
    };
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

  async enrichSkillPlugins(d: {
    owner: FileOwner;
    skillPlugins: CargoSkillPlugin[];
  }): Promise<EnrichedCargoSkillPlugin[]> {
    let owner = this.getBackingOwner(d.owner);
    let backingByCargoId = await this.syncSkillPluginBackings({
      owner,
      skillPlugins: d.skillPlugins
    });

    return d.skillPlugins.map(skillPlugin => ({
      ...skillPlugin,
      backing: backingByCargoId.get(skillPlugin.id)!
    }));
  }

  private async enrichSkillPlugin(d: {
    owner: FileOwner;
    skillPlugin: CargoSkillPlugin;
  }): Promise<EnrichedCargoSkillPlugin> {
    let [skillPlugin] = await this.enrichSkillPlugins({
      owner: d.owner,
      skillPlugins: [d.skillPlugin]
    });

    return skillPlugin!;
  }

  private async enrichSkillMarketplacePlugins(d: {
    owner: FileOwner;
    skillMarketplacePlugins: CargoSkillMarketplacePlugin[];
  }): Promise<EnrichedCargoSkillMarketplacePlugin[]> {
    let nestedPlugins = d.skillMarketplacePlugins.flatMap(item =>
      item.skillPlugin ? [item.skillPlugin] : []
    );
    let enrichedPlugins = await this.enrichSkillPlugins({
      owner: d.owner,
      skillPlugins: nestedPlugins
    });
    let pluginByCargoId = new Map(enrichedPlugins.map(plugin => [plugin.backing.id, plugin]));

    return d.skillMarketplacePlugins.map(item => ({
      ...item,
      skillPlugin: item.skillPlugin ? pluginByCargoId.get(item.skillPlugin.id) : undefined
    }));
  }

  private async resolveLocalPluginIds(d: { owner: FileOwner; ids?: string[] }) {
    return d.ids;
  }

  private async resolveLocalMarketplaceIds(d: { owner: FileOwner; ids?: string[] }) {
    return d.ids;
  }

  async listSkillPlugins(
    d: SkillPluginAccessInput & {
      ids?: string[];
      skillMarketplaceIds?: string[];
      skillMarketplacePluginIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: Array<'active' | 'archived' | 'deleted'>;
      category?: string;
      slug?: string;
      createdAt?: any;
      updatedAt?: any;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let [cargoPluginIds, cargoMarketplaceIds] = await Promise.all([
      this.resolveLocalPluginIds({ owner: d.owner, ids: d.ids }),
      this.resolveLocalMarketplaceIds({ owner: d.owner, ids: d.skillMarketplaceIds })
    ]);

    return Paginator.create(() => async input => {
      let result = await cargo.skillPlugin.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillPluginIds: cargoPluginIds,
        skillMarketplaceIds: cargoMarketplaceIds,
        skillMarketplacePluginIds: d.skillMarketplacePluginIds,
        skillConfigurationIds: d.skillConfigurationIds,
        statuses: d.statuses,
        category: d.category,
        slug: d.slug,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...input
      });

      return {
        items: await this.enrichSkillPlugins({
          owner: d.owner,
          skillPlugins: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillPluginById(
    d: SkillPluginAccessInput & {
      skillPluginId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let owner = this.getBackingOwner(d.owner);
    let backing = await db.skillPlugin.findFirst({
      where: {
        instanceOid: owner.instance.oid,
        id: d.skillPluginId,
        status: { not: 'deleted' }
      }
    });
    if (!backing) throw new ServiceError(notFoundError('skill.plugin', d.skillPluginId));

    let skillPlugin = await cargo.skillPlugin.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: backing.id
    });

    return {
      ...skillPlugin,
      backing
    };
  }

  async createSkillPlugin(
    d: SkillPluginAccessInput & {
      input: SkillPluginInput & { name: string };
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillPlugin = await cargo.skillPlugin.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      name: d.input.name,
      description: d.input.description,
      longDescription: d.input.longDescription,
      category: d.input.category,
      slug: d.input.slug,
      providerOverrides: d.input.providerOverrides,
      imageFileId: d.input.imageFileId,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return await this.enrichSkillPlugin({ owner: d.owner, skillPlugin });
  }

  async updateSkillPlugin(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      input: SkillPluginInput;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillPlugin = await cargo.skillPlugin.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      name: d.input.name,
      description: d.input.description,
      longDescription: d.input.longDescription,
      category: d.input.category,
      slug: d.input.slug,
      providerOverrides: d.input.providerOverrides,
      imageFileId: d.input.imageFileId,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return await this.enrichSkillPlugin({ owner: d.owner, skillPlugin });
  }

  async archiveSkillPlugin(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillPlugin = await cargo.skillPlugin.archive({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id
    });

    return await this.enrichSkillPlugin({ owner: d.owner, skillPlugin });
  }

  async forceSkillPluginSync(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let skillPlugin = await cargo.skillPlugin.sync({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id
    });

    return await this.enrichSkillPlugin({ owner: d.owner, skillPlugin });
  }

  async getSkillPluginEditorUrl(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      isReadOnly?: boolean;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillPlugin.getEditorUrl({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      isReadOnly: d.isReadOnly
    });
  }

  async listSkillMarketplacePlugins(
    d: SkillPluginAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      ids?: string[];
      skillPluginIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: Array<'active' | 'archived' | 'deleted'>;
      pluginSlug?: string;
      createdAt?: any;
      updatedAt?: any;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let cargoPluginIds = await this.resolveLocalPluginIds({
      owner: d.owner,
      ids: d.skillPluginIds
    });

    return Paginator.create(() => async input => {
      let result = await cargo.skillMarketplacePlugin.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillMarketplaceId: d.skillMarketplace.backing.id,
        skillMarketplacePluginIds: d.ids,
        skillPluginIds: cargoPluginIds,
        skillConfigurationIds: d.skillConfigurationIds,
        statuses: d.statuses,
        pluginSlug: d.pluginSlug,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...input
      });

      return {
        items: await this.enrichSkillMarketplacePlugins({
          owner: d.owner,
          skillMarketplacePlugins: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillMarketplacePluginById(
    d: SkillPluginAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      skillMarketplacePluginId: string;
    }
  ): Promise<EnrichedCargoSkillMarketplacePlugin> {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillMarketplacePlugin.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      skillMarketplacePluginId: d.skillMarketplacePluginId
    });

    let [enriched] = await this.enrichSkillMarketplacePlugins({
      owner: d.owner,
      skillMarketplacePlugins: [item]
    });

    return enriched!;
  }

  async addSkillMarketplacePlugin(
    d: SkillPluginAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      skillPlugin: EnrichedCargoSkillPlugin;
      input: {
        pluginSlug?: string;
        skillConfigurationId?: string | null;
      };
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillMarketplacePlugin.add({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      skillPluginId: d.skillPlugin.backing.id,
      pluginSlug: d.input.pluginSlug,
      skillConfigurationId: d.input.skillConfigurationId
    });

    let [enriched] = await this.enrichSkillMarketplacePlugins({
      owner: d.owner,
      skillMarketplacePlugins: [
        {
          ...item,
          skillPlugin: item.skillPlugin ?? d.skillPlugin
        }
      ]
    });

    return enriched!;
  }

  async removeSkillMarketplacePlugin(
    d: SkillPluginAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      skillMarketplacePluginId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillMarketplacePlugin.remove({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      skillMarketplacePluginId: d.skillMarketplacePluginId
    });

    let [enriched] = await this.enrichSkillMarketplacePlugins({
      owner: d.owner,
      skillMarketplacePlugins: [item]
    });

    return enriched!;
  }

  async listSkillPluginSkills(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      ids?: string[];
      skillIds?: string[];
      skillConfigurationIds?: string[];
      statuses?: Array<'active' | 'archived' | 'deleted'>;
      pluginSkillSlug?: string;
      createdAt?: any;
      updatedAt?: any;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillPluginSkill.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillPluginId: d.skillPlugin.backing.id,
        skillPluginSkillIds: d.ids,
        skillIds: d.skillIds,
        skillConfigurationIds: d.skillConfigurationIds,
        statuses: d.statuses,
        pluginSkillSlug: d.pluginSkillSlug,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...input
      });

      return {
        items: result.items.map(item => ({
          ...item,
          skillPlugin: d.skillPlugin
        })),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillPluginSkillById(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      skillPluginSkillId: string;
    }
  ): Promise<EnrichedCargoSkillPluginSkill> {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillPluginSkill.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillPluginSkillId: d.skillPluginSkillId
    });

    return {
      ...item,
      skillPlugin: d.skillPlugin
    };
  }

  async addSkillPluginSkill(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      input: SkillPluginSkillInput & {
        skillId: string;
        pluginSkillSlug?: string;
      };
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillPluginSkill.add({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillId: d.input.skillId,
      pluginSkillSlug: d.input.pluginSkillSlug,
      clientName: d.input.clientName,
      clientDescription: d.input.clientDescription,
      clientMetadata: d.input.clientMetadata,
      license: d.input.license,
      compatibility: d.input.compatibility,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return {
      ...item,
      skillPlugin: d.skillPlugin
    };
  }

  async updateSkillPluginSkill(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      skillPluginSkillId: string;
      input: SkillPluginSkillInput;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillPluginSkill.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillPluginSkillId: d.skillPluginSkillId,
      clientName: d.input.clientName,
      clientDescription: d.input.clientDescription,
      clientMetadata: d.input.clientMetadata,
      license: d.input.license,
      compatibility: d.input.compatibility,
      skillConfigurationId: d.input.skillConfigurationId
    });

    return {
      ...item,
      skillPlugin: d.skillPlugin
    };
  }

  async removeSkillPluginSkill(
    d: SkillPluginAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      skillPluginSkillId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);
    let item = await cargo.skillPluginSkill.remove({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillPluginSkillId: d.skillPluginSkillId
    });

    return {
      ...item,
      skillPlugin: d.skillPlugin
    };
  }
}

export let skillPluginService = Service.create(
  'fileSkillPlugin',
  () => new SkillPluginServiceImpl()
).build();
