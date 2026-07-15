import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  cargo,
  type CargoActor,
  type CargoSkillMergePlan,
  type CargoSkillMergeRequest,
  type CargoSkillMergeRequestComment,
  type CargoSkillMergeRequestEvent,
  type CargoSkillMergeRequestItem
} from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
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

export type EnrichedCargoSkillMergeRequest = Omit<CargoSkillMergeRequest, 'createdByActor'> & {
  createdByActor: EnrichedCargoDocumentActor | undefined;
};

export type EnrichedCargoSkillMergeRequestItem = Omit<
  CargoSkillMergeRequestItem,
  'resolvedByActor'
> & {
  resolvedByActor: EnrichedCargoDocumentActor | undefined;
};

export type EnrichedCargoSkillMergeRequestComment = Omit<
  CargoSkillMergeRequestComment,
  'actor'
> & {
  actor: EnrichedCargoDocumentActor;
};

export type EnrichedCargoSkillMergeRequestEvent = Omit<
  CargoSkillMergeRequestEvent,
  'actor' | 'comment'
> & {
  actor: EnrichedCargoDocumentActor | undefined;
  comment: EnrichedCargoSkillMergeRequestComment | undefined;
};

type CargoSkillMergePlanItem = CargoSkillMergePlan['items'][number];

export type EnrichedCargoSkillMergePlanItem = Omit<
  CargoSkillMergePlanItem,
  'resolvedByActor'
> & {
  resolvedByActor: EnrichedCargoDocumentActor | undefined;
};

export type EnrichedCargoSkillMergePlan = Omit<
  CargoSkillMergePlan,
  'mergeRequest' | 'items'
> & {
  mergeRequest: EnrichedCargoSkillMergeRequest;
  items: EnrichedCargoSkillMergePlanItem[];
};

class SkillMergeRequestServiceImpl {
  private async getAccess(d: SkillMergeRequestAccessInput) {
    return await resolveCargoAccess(d);
  }

  private async enrichActors(d: {
    owner: FileOwner;
    actors: Array<CargoActor | undefined>;
  }): Promise<Array<EnrichedCargoDocumentActor | undefined>> {
    let actors = d.actors.filter((actor): actor is CargoActor => !!actor);
    let enrichedActors = await documentParticipantService.enrichActors({
      owner: d.owner,
      actors
    });
    let enrichedActorIndex = 0;

    return d.actors.map(actor => {
      if (!actor) return undefined;
      return enrichedActors[enrichedActorIndex++]!;
    });
  }

  private async enrichMergeRequests(d: {
    owner: FileOwner;
    skillMergeRequests: CargoSkillMergeRequest[];
  }): Promise<EnrichedCargoSkillMergeRequest[]> {
    let actors = await this.enrichActors({
      owner: d.owner,
      actors: d.skillMergeRequests.map(skillMergeRequest => skillMergeRequest.createdByActor)
    });

    return d.skillMergeRequests.map((skillMergeRequest, index) => ({
      ...skillMergeRequest,
      createdByActor: actors[index]
    }));
  }

  private async enrichItems<T extends CargoSkillMergeRequestItem>(d: {
    owner: FileOwner;
    items: T[];
  }): Promise<Array<Omit<T, 'resolvedByActor'> & EnrichedCargoSkillMergeRequestItem>> {
    let actors = await this.enrichActors({
      owner: d.owner,
      actors: d.items.map(item => item.resolvedByActor)
    });

    return d.items.map((item, index) => ({
      ...item,
      resolvedByActor: actors[index]
    }));
  }

  private async enrichComments(d: {
    owner: FileOwner;
    comments: CargoSkillMergeRequestComment[];
  }): Promise<EnrichedCargoSkillMergeRequestComment[]> {
    let actors = await this.enrichActors({
      owner: d.owner,
      actors: d.comments.map(comment => comment.actor)
    });

    return d.comments.map((comment, index) => ({
      ...comment,
      actor: actors[index]!
    }));
  }

  private async enrichEvents(d: {
    owner: FileOwner;
    events: CargoSkillMergeRequestEvent[];
  }): Promise<EnrichedCargoSkillMergeRequestEvent[]> {
    let actors = await this.enrichActors({
      owner: d.owner,
      actors: [
        ...d.events.map(event => event.actor),
        ...d.events.map(event => event.comment?.actor)
      ]
    });

    return d.events.map((event, index) => ({
      ...event,
      actor: actors[index],
      comment: event.comment
        ? {
            ...event.comment,
            actor: actors[d.events.length + index]!
          }
        : undefined
    }));
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

    let skillMergeRequest = await cargo.skillMergeRequest.create({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      actorId: access.actorId,
      sourceSkillId: d.sourceSkillId,
      targetSkillId: d.targetSkillId,
      title: d.title,
      description: d.description
    });

    return (
      await this.enrichMergeRequests({
        owner: d.owner,
        skillMergeRequests: [skillMergeRequest]
      })
    )[0]!;
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
        items: await this.enrichMergeRequests({
          owner: d.owner,
          skillMergeRequests: result.items
        }),
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

    let skillMergeRequest = await cargo.skillMergeRequest.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });

    return (
      await this.enrichMergeRequests({
        owner: d.owner,
        skillMergeRequests: [skillMergeRequest]
      })
    )[0]!;
  }

  async getSkillMergePlan(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
    }
  ): Promise<EnrichedCargoSkillMergePlan> {
    let access = await this.getAccess(d);

    let skillMergePlan = await cargo.skillMergeRequest.getPlan({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });

    let [mergeRequest] = await this.enrichMergeRequests({
      owner: d.owner,
      skillMergeRequests: [skillMergePlan.mergeRequest]
    });
    let items = await this.enrichItems({
      owner: d.owner,
      items: skillMergePlan.items
    });

    return {
      ...skillMergePlan,
      mergeRequest: mergeRequest!,
      items
    };
  }

  async resolveSkillMergeRequestItem(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      itemId: string;
      resolutionType: SkillMergeRequestResolutionType;
      resolution?: any;
    }
  ): Promise<EnrichedCargoSkillMergeRequestItem> {
    let access = await this.getAccess(d);

    let item = await cargo.skillMergeRequest.resolveItem({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      itemId: d.itemId,
      actorId: access.actorId,
      resolutionType: d.resolutionType,
      resolution: d.resolution
    });

    return (
      await this.enrichItems({
        owner: d.owner,
        items: [item]
      })
    )[0]!;
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
  ): Promise<EnrichedCargoSkillMergeRequestItem[]> {
    let access = await this.getAccess(d);

    let items = await cargo.skillMergeRequest.bulkResolveItems({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId,
      items: d.items
    });

    return await this.enrichItems({
      owner: d.owner,
      items
    });
  }

  async performSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<EnrichedCargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    let skillMergeRequest = await cargo.skillMergeRequest.perform({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });

    return (
      await this.enrichMergeRequests({
        owner: d.owner,
        skillMergeRequests: [skillMergeRequest]
      })
    )[0]!;
  }

  async closeSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<EnrichedCargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    let skillMergeRequest = await cargo.skillMergeRequest.close({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });

    return (
      await this.enrichMergeRequests({
        owner: d.owner,
        skillMergeRequests: [skillMergeRequest]
      })
    )[0]!;
  }

  async rollbackSkillMergeRequest(
    d: SkillMergeRequestAccessInput & { skillMergeRequestId: string }
  ): Promise<EnrichedCargoSkillMergeRequest> {
    let access = await this.getAccess(d);

    let skillMergeRequest = await cargo.skillMergeRequest.rollback({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      actorId: access.actorId
    });

    return (
      await this.enrichMergeRequests({
        owner: d.owner,
        skillMergeRequests: [skillMergeRequest]
      })
    )[0]!;
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
        items: await this.enrichComments({
          owner: d.owner,
          comments: result.items
        }),
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
  ): Promise<EnrichedCargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    let comment = await cargo.skillMergeRequest.comment.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId
    });

    return (
      await this.enrichComments({
        owner: d.owner,
        comments: [comment]
      })
    )[0]!;
  }

  async createSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      skillMergeRequestItemId?: string;
      inReplyToCommentId?: string;
      body: string;
      path?: string | null;
    }
  ): Promise<EnrichedCargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    let comment = await cargo.skillMergeRequest.comment.create({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      skillMergeRequestItemId: d.skillMergeRequestItemId,
      inReplyToCommentId: d.inReplyToCommentId,
      actorId: access.actorId!,
      body: d.body,
      path: d.path
    });

    return (
      await this.enrichComments({
        owner: d.owner,
        comments: [comment]
      })
    )[0]!;
  }

  async updateSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      commentId: string;
      body: string;
    }
  ): Promise<EnrichedCargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    let comment = await cargo.skillMergeRequest.comment.update({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId!,
      body: d.body,
      canManageComments: access.overridePermissions === true
    });

    return (
      await this.enrichComments({
        owner: d.owner,
        comments: [comment]
      })
    )[0]!;
  }

  async deleteSkillMergeRequestComment(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      commentId: string;
    }
  ): Promise<EnrichedCargoSkillMergeRequestComment> {
    let access = await this.getAccess(d);

    let comment = await cargo.skillMergeRequest.comment.delete({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      commentId: d.commentId,
      actorId: access.actorId!,
      canManageComments: access.overridePermissions === true
    });

    return (
      await this.enrichComments({
        owner: d.owner,
        comments: [comment]
      })
    )[0]!;
  }

  async listSkillMergeRequestEvents(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      types?: Array<
        | 'created'
        | 'commented'
        | 'all_conflicts_resolved'
        | 'merge_started'
        | 'merge_completed'
        | 'merge_failed'
        | 'closed'
        | 'rolled_back'
      >;
      createdAt?: any;
    }
  ) {
    let access = await this.getAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillMergeRequest.event.list({
        tenantId: access.scope.tenantId,
        environmentId: access.scope.environmentId,
        skillMergeRequestId: d.skillMergeRequestId,
        actorId: access.actorId,
        types: d.types,
        createdAt: d.createdAt,
        ...input
      });

      return {
        items: await this.enrichEvents({
          owner: d.owner,
          events: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillMergeRequestEventById(
    d: SkillMergeRequestAccessInput & {
      skillMergeRequestId: string;
      eventId: string;
    }
  ): Promise<EnrichedCargoSkillMergeRequestEvent> {
    let access = await this.getAccess(d);
    let event = await cargo.skillMergeRequest.event.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      skillMergeRequestId: d.skillMergeRequestId,
      eventId: d.eventId,
      actorId: access.actorId
    });

    return (
      await this.enrichEvents({
        owner: d.owner,
        events: [event]
      })
    )[0]!;
  }
}

export type {
  CargoSkillMergePlan,
  CargoSkillMergeRequest,
  CargoSkillMergeRequestComment,
  CargoSkillMergeRequestEvent,
  CargoSkillMergeRequestItem,
  SkillMergeRequestResolutionType
};

export let skillMergeRequestService = Service.create(
  'fileSkillMergeRequest',
  () => new SkillMergeRequestServiceImpl()
).build();
