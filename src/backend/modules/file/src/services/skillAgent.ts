import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillAgent } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import { storeService } from './store';

type SkillAgentAccessInput = {
  owner: FileOwner;
  skillId: string;
  storeId: string;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

class SkillAgentServiceImpl {
  private async assertStoreAccess(d: SkillAgentAccessInput) {
    await storeService.getStoreById({
      owner: d.owner,
      storeId: d.storeId,
      accessActor: d.accessActor,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async createSkillAgent(
    d: SkillAgentAccessInput & {
      input: {
        name: string;
        description?: string | null;
        content?: string;
      };
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.skillAgent.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillId: d.skillId,
      name: d.input.name,
      description: d.input.description,
      content: d.input.content,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async listSkillAgents(
    d: SkillAgentAccessInput & {
      includeArchived?: boolean;
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillAgent.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillId: d.skillId,
        includeArchived: d.includeArchived,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillAgentById(
    d: SkillAgentAccessInput & {
      skillAgentId: string;
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope } = await resolveCargoAccess(d);
    let skillAgent = await cargo.skillAgent.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillAgentId: d.skillAgentId
    });

    if (skillAgent.skillId !== d.skillId) {
      throw new ServiceError(notFoundError('skill.agent', d.skillAgentId));
    }

    return skillAgent;
  }

  async updateSkillAgent(
    d: SkillAgentAccessInput & {
      skillAgent: CargoSkillAgent;
      input: {
        name?: string;
        description?: string | null;
      };
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.skillAgent.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillAgentId: d.skillAgent.id,
      name: d.input.name,
      description: d.input.description,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async deleteSkillAgent(
    d: SkillAgentAccessInput & {
      skillAgent: CargoSkillAgent;
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    return await cargo.skillAgent.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillAgentId: d.skillAgent.id,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }
}

export type { CargoSkillAgent };

export let skillAgentService = Service.create(
  'fileSkillAgent',
  () => new SkillAgentServiceImpl()
).build();
