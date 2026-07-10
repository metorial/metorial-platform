import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMergeRequestsEventsGetOutput,
  mapDashboardInstanceSkillsMergeRequestsEventsListOutput,
  mapDashboardInstanceSkillsMergeRequestsEventsListQuery,
  type DashboardInstanceSkillsMergeRequestsEventsGetOutput,
  type DashboardInstanceSkillsMergeRequestsEventsListOutput,
  type DashboardInstanceSkillsMergeRequestsEventsListQuery
} from '../resources';

/**
 * @name Skill Merge Request Events controller
 * @description Inspect the activity history of skill merge requests.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMergeRequestsEventsEndpoint {
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
   * @name List skill merge request events
   * @description Returns a paginated activity history for a skill merge request.
   *
   * @param `skillMergeRequestId` - string
   * @param `query` - DashboardInstanceSkillsMergeRequestsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillMergeRequestId: string,
    query?: DashboardInstanceSkillsMergeRequestsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsEventsListOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMergeRequestsEventsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsEventsListOutput
    );
  }

  /**
   * @name Get skill merge request event
   * @description Retrieves one event from a skill merge request activity history.
   *
   * @param `skillMergeRequestId` - string
   * @param `eventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMergeRequestId: string,
    eventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsEventsGetOutput> {
    let path = `skill-merge-requests/${skillMergeRequestId}/events/${eventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsEventsGetOutput
    );
  }
}
