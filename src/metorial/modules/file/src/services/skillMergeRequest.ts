import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  cargo,
  type CargoSkillMergePlan,
  type CargoSkillMergeRequest,
  type CargoSkillMergeRequestComment,
  type CargoSkillMergeRequestItem
} from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

type SkillMergeRequestAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

type SkillMergeRequestResolutionType =
  | 'accept_source'
  | 'keep_target'
  | 'remove'
  | 'edit_document'
  | 'replace_file'
  | 'skip';

class SkillMergeRequestServiceImpl {
  private async getAccess(d: SkillMergeRequestAccessInput) {
    return await resolveCargoAccess(d);
  }

  async createSkillMergeRequest(
    d: SkillMergeRequestAccessInput & {
      sourceSkillId: string;
      targetSkillId?: string;
      title: string;
      description?: string | null;
    }
  ) {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.create({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      actorId: access.actorId,
      sourceSkillId: d.sourceSkillId,
      targetSkillId: d.targetSkillId,
      title: d.title,
      description: d.description
    });
  }

  async listSkillMergeRequests(
    d: SkillMergeRequestAccessInput & {
      ids?: string[];
      sourceSkillIds?: string[];
      targetSkillIds?: string[];
      statuses?: Array<'open' | 'closed' | 'merging' | 'merged'>;
      createdByActorIds?: string[];
      createdAt?: any;
    }
  ) {
    let access = await this.getAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillMergeRequest.list({
        tenantId: access.scope.tenantId,
        environmentId: access.scope.environmentId,
        actorId: access.actorId,
        skillMergeRequestIds: d.ids,
        sourceSkillIds: d.sourceSkillIds,
        targetSkillIds: d.targetSkillIds,
        statuses: d.statuses,
        createdByActorIds: d.createdByActorIds,
        createdAt: d.createdAt,
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

  async getSkillMergeRequestById(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
    }
  ) {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });
  }

  async getSkillMergePlan(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
    }
  ): Promise<CargoSkillMergePlan> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.getPlan({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });
  }

  async resolveSkillMergeRequestItem(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      itemId: string;
      resolutionType: SkillMergeRequestResolutionType;
      resolution?: any;
    }
  ): Promise<CargoSkillMergeRequestItem> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.resolveItem({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      itemId: d.itemId,
      actorId: access.actorId,
      resolutionType: d.resolutionType,
      resolution: d.resolution
    });
  }

  async bulkResolveSkillMergeRequestItems(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      items: {
        itemId: string;
        resolutionType: SkillMergeRequestResolutionType;
        resolution?: any;
      }[];
    }
  ): Promise<CargoSkillMergeRequestItem[]> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.bulkResolveItems({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId,
      items: d.items
    });
  }

  async performSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<CargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.perform({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });
  }

  async closeSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<CargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.close({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });
  }

  async rollbackSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<CargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.rollback({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });
  }

  async listSkillMergeRequestComments(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      skillMergeRequestItemId?: string;
    }
  ) {
    let access = await this.getAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillMergeRequest.comment.list({
        tenantId: access.scope.tenantId,
        environmentId: access.scope.environmentId,
        skillMergeRequestId: d.skillMergeRequestId,
        skillMergeRequestItemId: d.skillMergeRequestItemId,
        actorId: access.actorId,
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

  async getSkillMergeRequestCommentById(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      commentId: string;
    }
  ): Promise<CargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.comment.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId
    });
  }

  async createSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      skillMergeRequestItemId?: string;
      inReplyToCommentId?: string;
      body: string;
      path?: string | null;
    }
  ): Promise<CargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.comment.create({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      skillMergeRequestItemId: d.skillMergeRequestItemId,
      inReplyToCommentId: d.inReplyToCommentId,
      actorId: access.actorId!,
      body: d.body,
      path: d.path
    });
  }

  async updateSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      commentId: string;
      body: string;
    }
  ): Promise<CargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.comment.update({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId!,
      body: d.body
    });
  }

  async deleteSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      commentId: string;
    }
  ): Promise<CargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    return await cargo.skillMergeRequest.comment.delete({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId!
    });
  }
}

export type {
  CargoSkillMergePlan,
  CargoSkillMergeRequest,
  CargoSkillMergeRequestComment,
  CargoSkillMergeRequestItem,
  SkillMergeRequestResolutionType
};

export let skillMergeRequestService = Service.create(
  'fileSkillMergeRequest',
  () => new SkillMergeRequestServiceImpl()
).build();
