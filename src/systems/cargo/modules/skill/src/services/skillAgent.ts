import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import type { Prisma, StoreParticipantPermissions } from '@metorial-cargo/db';
import { db, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveDocuments,
  resolveSkillAgents,
  resolveStoreItems
} from '@metorial-cargo/list-utils';
import { documentService } from '@metorial-cargo/module-doc';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { actorService } from '@metorial-cargo/module-file';
import {
  storeAccessService,
  storeService,
  storeWritePermission
} from '@metorial-cargo/module-store';
import type { SkillRecord } from './skill';

export let skillAgentInclude = {
  skill: {
    include: {
      store: true
    }
  },
  storeItem: {
    select: {
      id: true,
      path: true
    }
  },
  document: {
    select: {
      id: true
    }
  }
} satisfies Prisma.SkillAgentInclude;

export type SkillAgentRecord = Prisma.SkillAgentGetPayload<{
  include: typeof skillAgentInclude;
}>;

class SkillAgentServiceImpl {
  private normalizeCreateName(name: string) {
    let normalizedName = name.trim();
    if (!normalizedName) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill agent name cannot be empty'
        })
      );
    }

    let slugInput = normalizedName.toLowerCase().endsWith('.md')
      ? normalizedName.slice(0, -3)
      : normalizedName;
    let slug = slugify(slugInput);
    if (!slug) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill agent name must include at least one slug character'
        })
      );
    }

    return {
      name: normalizedName,
      slug,
      path: `/agents/${slug}.md`
    };
  }

  private async getSkillAgentRecord(
    d: CargoTenantEnvironment & {
      skillAgentId: string;
      includeArchived?: boolean;
    }
  ) {
    return await withTransaction(
      async db => {
        let skillAgent = await db.skillAgent.findFirst({
          where: {
            id: d.skillAgentId,
            status: d.includeArchived ? undefined : 'active',
            skill: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
            }
          },
          include: skillAgentInclude
        });

        if (!skillAgent) throw new ServiceError(notFoundError('skill.agent', d.skillAgentId));

        return skillAgent;
      },
      { ifExists: true }
    );
  }

  async createSkillAgent(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      input: {
        name: string;
        description?: string | null;
        content?: string;
        actorId?: string;
        defaultPermissions?: StoreParticipantPermissions[];
        overridePermissions?: boolean;
      };
    }
  ) {
    if (!d.input.content?.trim()) {
      d.input.content = [
        `# ${d.input.name}`,
        d.input.description?.trim().length ? `> ${d.input.description}` : undefined,
        `Describe your agent here. It has access to all resources and tools of the associated skill. Describe the personality, behavior, and capabilities of the agent; use examples and concrete details to help it use the skill effectively.`
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    let input = this.normalizeCreateName(d.input.name);
    let document = await documentService.createDocument({
      tenant: d.tenant,
      environment: d.environment,
      input: {
        title: input.name,
        content: d.input.content ?? '',
        actorId: d.input.actorId,
        store: {
          id: d.skill.store.id,
          path: input.path
        },
        defaultPermissions: d.input.defaultPermissions,
        overridePermissions: d.input.overridePermissions
      }
    });

    let skillAgent = await db.skillAgent.findFirst({
      where: {
        skillOid: d.skill.oid,
        documentOid: document.oid,
        status: 'active'
      },
      include: skillAgentInclude
    });

    if (!skillAgent) {
      throw new ServiceError(notFoundError('skillAgent', document.id));
    }

    if (d.input.description !== undefined) {
      await db.skillAgent.update({
        where: {
          id: skillAgent.id
        },
        data: {
          description: d.input.description
        }
      });
    }

    return await this.getSkillAgentRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillAgentId: skillAgent.id
    });
  }

  async listSkillAgents(
    d: CargoTenantEnvironment & {
      ids?: string[];
      skillId: string;
      documentIds?: string[];
      storeItemIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
      archivedAt?: DateFilter;
      includeArchived?: boolean;
    }
  ) {
    let skillAgents = await resolveSkillAgents(d, d.ids);
    let documents = await resolveDocuments(d, d.documentIds);
    let storeItems = await resolveStoreItems(d, d.storeItemIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillAgent.findMany({
            ...opts,
            where: {
              oid: skillAgents ? skillAgents.in : undefined,
              status: d.includeArchived ? undefined : 'active',
              skill: {
                tenantOid: d.tenant.oid,
                environmentOid: d.environment.oid,
                id: d.skillId
              },
              documentOid: documents ? documents.in : undefined,
              storeItemOid: storeItems ? storeItems.in : undefined,
              AND: [
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,
                d.archivedAt ? { archivedAt: normalizeDateFilter(d.archivedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillAgentInclude
          })
      )
    );
  }

  async getSkillAgentById(
    d: CargoTenantEnvironment & {
      skillAgentId: string;
      includeArchived?: boolean;
    }
  ) {
    return await this.getSkillAgentRecord(d);
  }

  async updateSkillAgent(
    d: CargoTenantEnvironment & {
      skillAgent: SkillAgentRecord;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
      input: {
        name?: string;
        description?: string | null;
      };
    }
  ) {
    if (d.input.name === undefined && d.input.description === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill agent field must be updated'
        })
      );
    }

    let name = d.input.name?.trim();
    if (d.input.name !== undefined && !name) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill agent name cannot be empty'
        })
      );
    }

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.skillAgent.skill.store,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    await db.skillAgent.update({
      where: {
        id: d.skillAgent.id
      },
      data: {
        name,
        description: d.input.description
      }
    });

    let fullDocument = await documentService.getDocumentById({
      tenant: d.tenant,
      environment: d.environment,
      documentId: d.skillAgent.document.id
    });

    await documentService.updateDocument({
      tenant: d.tenant,
      environment: d.environment,
      document: fullDocument,
      input: {
        title: name ?? d.skillAgent.name,
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      }
    });

    return await this.getSkillAgentRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillAgentId: d.skillAgent.id
    });
  }

  async deleteSkillAgent(
    d: CargoTenantEnvironment & {
      skillAgent: SkillAgentRecord;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let actor = d.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.actorId
        })
      : undefined;

    if (d.skillAgent.storeItem) {
      await storeService.modifyStoreItems({
        tenant: d.tenant,
        environment: d.environment,
        store: d.skillAgent.skill.store,
        operations: [
          {
            type: 'remove',
            itemId: d.skillAgent.storeItem.id
          }
        ],
        actor,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      });
    } else {
      await db.skillAgent.update({
        where: {
          id: d.skillAgent.id
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });
    }

    return await this.getSkillAgentRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillAgentId: d.skillAgent.id,
      includeArchived: true
    });
  }
}

export let skillAgentService = Service.create(
  'cargoSkillAgentService',
  () => new SkillAgentServiceImpl()
).build();
