import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsSecurityReviewDismissOutput,
  mapDashboardInstanceSkillsSecurityReviewGetOutput,
  mapDashboardInstanceSkillsSecurityReviewReassessOutput,
  mapDashboardInstanceSkillsSecurityReviewRestoreOutput,
  type DashboardInstanceSkillsSecurityReviewDismissOutput,
  type DashboardInstanceSkillsSecurityReviewGetOutput,
  type DashboardInstanceSkillsSecurityReviewReassessOutput,
  type DashboardInstanceSkillsSecurityReviewRestoreOutput
} from '../resources';

/**
 * @name Skill Security Reviews controller
 * @description A security review assesses what a skill makes an agent do and whether its files can be trusted. Everyone who can read a skill can read its review.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsSecurityReviewEndpoint {
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
   * @name Get skill security review
   * @description Returns the security review of a skill's latest version. Requests a review if none exists yet.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewGetOutput> {
    let path = `skills/${skillId}/security-review`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsSecurityReviewGetOutput
    );
  }

  /**
   * @name Reassess skill security review
   * @description Starts a new review of the skill. Pending edits are sealed into a new version first.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewReassessOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reassess(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewReassessOutput> {
    let path = `skills/${skillId}/security-review/reassess`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsSecurityReviewReassessOutput
    );
  }

  /**
   * @name Dismiss skill security review
   * @description Stops reviewing the skill. Its verdict becomes `dismissed` and no longer holds back the skill.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewDismissOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  dismiss(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewDismissOutput> {
    let path = `skills/${skillId}/security-review/dismiss`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsSecurityReviewDismissOutput
    );
  }

  /**
   * @name Restore skill security review
   * @description Resumes reviewing a dismissed skill and starts a new review.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSecurityReviewRestoreOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  restore(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSecurityReviewRestoreOutput> {
    let path = `skills/${skillId}/security-review/restore`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsSecurityReviewRestoreOutput
    );
  }
}
