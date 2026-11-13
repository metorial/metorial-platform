import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsSecurityReviewRevisionsGetOutput,
  mapDashboardInstanceSkillsSecurityReviewRevisionsListOutput,
  mapDashboardInstanceSkillsSecurityReviewRevisionsListQuery,
  type DashboardInstanceSkillsSecurityReviewRevisionsGetOutput,
  type DashboardInstanceSkillsSecurityReviewRevisionsListOutput,
  type DashboardInstanceSkillsSecurityReviewRevisionsListQuery
} from '../resources';

/**
 * @name Skill Security Reviews controller
 * @description A security review assesses what a skill makes an agent do and whether its files can be trusted. Everyone who can read a skill can read its review.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsSecurityReviewRevisionsEndpoint {
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
   * @name List skill security review revisions
   * @description Returns the most recent finished revisions of a skill's security review.
   *
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsSecurityReviewRevisionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewRevisionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillId: string,
    query?: DashboardInstanceSkillsSecurityReviewRevisionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewRevisionsListOutput> {
    let path = `skills/${skillId}/security-review/revisions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsSecurityReviewRevisionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsSecurityReviewRevisionsListOutput
    );
  }

  /**
   * @name Get skill security review revision
   * @description Retrieves a single revision of a skill's security review.
   *
   * @param `skillId` - string
   * @param `revisionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewRevisionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    revisionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewRevisionsGetOutput> {
    let path = `skills/${skillId}/security-review/revisions/${revisionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsSecurityReviewRevisionsGetOutput
    );
  }
}
