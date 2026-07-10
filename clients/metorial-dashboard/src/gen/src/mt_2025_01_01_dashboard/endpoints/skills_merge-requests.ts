import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMergeRequestsCloseOutput,
  mapDashboardInstanceSkillsMergeRequestsCreateBody,
  mapDashboardInstanceSkillsMergeRequestsCreateOutput,
  mapDashboardInstanceSkillsMergeRequestsGetOutput,
  mapDashboardInstanceSkillsMergeRequestsListOutput,
  mapDashboardInstanceSkillsMergeRequestsListQuery,
  mapDashboardInstanceSkillsMergeRequestsPerformOutput,
  mapDashboardInstanceSkillsMergeRequestsRollbackOutput,
  type DashboardInstanceSkillsMergeRequestsCloseOutput,
  type DashboardInstanceSkillsMergeRequestsCreateBody,
  type DashboardInstanceSkillsMergeRequestsCreateOutput,
  type DashboardInstanceSkillsMergeRequestsGetOutput,
  type DashboardInstanceSkillsMergeRequestsListOutput,
  type DashboardInstanceSkillsMergeRequestsListQuery,
  type DashboardInstanceSkillsMergeRequestsPerformOutput,
  type DashboardInstanceSkillsMergeRequestsRollbackOutput
} from '../resources';

/**
 * @name Skill Merge Requests controller
 * @description Review, resolve, and apply changes between skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMergeRequestsEndpoint {
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
   * @name List skill merge requests
   * @description Returns a paginated list of skill merge requests.
   *
   * @param `query` - DashboardInstanceSkillsMergeRequestsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsMergeRequestsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsListOutput> {
    let path = 'skill-merge-requests';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMergeRequestsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsListOutput
    );
  }

  /**
   * @name Create skill merge request
   * @description Creates a merge request from one skill into another.
   *
   * @param `body` - DashboardInstanceSkillsMergeRequestsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsMergeRequestsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCreateOutput> {
    let path = 'skill-merge-requests';

    let request = {
      path,
      body: mapDashboardInstanceSkillsMergeRequestsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCreateOutput
    );
  }

  /**
   * @name Get skill merge request
   * @description Retrieves a skill merge request.
   *
   * @param `skillMergeRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMergeRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsGetOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsGetOutput
    );
  }

  /**
   * @name Perform skill merge request
   * @description Queues application of a resolved skill merge request.
   *
   * @param `skillMergeRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsPerformOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  perform(
    skillMergeRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsPerformOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/perform`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMergeRequestsPerformOutput
    );
  }

  /**
   * @name Close skill merge request
   * @description Closes an open skill merge request without applying it.
   *
   * @param `skillMergeRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsCloseOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  close(
    skillMergeRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsCloseOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/close`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMergeRequestsCloseOutput
    );
  }

  /**
   * @name Rollback skill merge request
   * @description Restores the target skill to its state before a completed merge.
   *
   * @param `skillMergeRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsRollbackOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rollback(
    skillMergeRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsRollbackOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/rollback`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMergeRequestsRollbackOutput
    );
  }
}
