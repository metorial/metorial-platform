import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMergeRequestsCommentsCreateBody,
  mapDashboardInstanceSkillsMergeRequestsCommentsCreateOutput,
  mapDashboardInstanceSkillsMergeRequestsCommentsDeleteOutput,
  mapDashboardInstanceSkillsMergeRequestsCommentsGetOutput,
  mapDashboardInstanceSkillsMergeRequestsCommentsListOutput,
  mapDashboardInstanceSkillsMergeRequestsCommentsListQuery,
  mapDashboardInstanceSkillsMergeRequestsCommentsUpdateBody,
  mapDashboardInstanceSkillsMergeRequestsCommentsUpdateOutput,
  type DashboardInstanceSkillsMergeRequestsCommentsCreateBody,
  type DashboardInstanceSkillsMergeRequestsCommentsCreateOutput,
  type DashboardInstanceSkillsMergeRequestsCommentsDeleteOutput,
  type DashboardInstanceSkillsMergeRequestsCommentsGetOutput,
  type DashboardInstanceSkillsMergeRequestsCommentsListOutput,
  type DashboardInstanceSkillsMergeRequestsCommentsListQuery,
  type DashboardInstanceSkillsMergeRequestsCommentsUpdateBody,
  type DashboardInstanceSkillsMergeRequestsCommentsUpdateOutput
} from '../resources';

/**
 * @name Skill Merge Requests controller
 * @description Review, resolve, and apply changes between skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMergeRequestsCommentsEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List skill merge request comments
   * @description Lists comments on a skill merge request or one of its items.
   *
   * @param `skillMergeRequestId` - string
   * @param `query` - DashboardInstanceSkillsMergeRequestsCommentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCommentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillMergeRequestId: string,
    query?: DashboardInstanceSkillsMergeRequestsCommentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCommentsListOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/comments`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMergeRequestsCommentsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCommentsListOutput
    );
  }

  /**
   * @name Create skill merge request comment
   * @description Adds a comment to a skill merge request or one of its items.
   *
   * @param `skillMergeRequestId` - string
   * @param `body` - DashboardInstanceSkillsMergeRequestsCommentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCommentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    skillMergeRequestId: string,
    body: DashboardInstanceSkillsMergeRequestsCommentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCommentsCreateOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/comments`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMergeRequestsCommentsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCommentsCreateOutput
    );
  }

  /**
   * @name Get skill merge request comment
   * @description Retrieves a comment on a skill merge request.
   *
   * @param `skillMergeRequestId` - string
   * @param `commentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCommentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMergeRequestId: string,
    commentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCommentsGetOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/comments/${commentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCommentsGetOutput
    );
  }

  /**
   * @name Update skill merge request comment
   * @description Updates a comment authored by the current actor.
   *
   * @param `skillMergeRequestId` - string
   * @param `commentId` - string
   * @param `body` - DashboardInstanceSkillsMergeRequestsCommentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCommentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillMergeRequestId: string,
    commentId: string,
    body: DashboardInstanceSkillsMergeRequestsCommentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCommentsUpdateOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/comments/${commentId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMergeRequestsCommentsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCommentsUpdateOutput
    );
  }

  /**
   * @name Delete skill merge request comment
   * @description Deletes a comment authored by the current actor.
   *
   * @param `skillMergeRequestId` - string
   * @param `commentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCommentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillMergeRequestId: string,
    commentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCommentsDeleteOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/comments/${commentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCommentsDeleteOutput
    );
  }
}
