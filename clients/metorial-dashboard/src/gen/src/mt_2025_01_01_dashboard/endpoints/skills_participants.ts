import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsParticipantsGetOutput,
  mapDashboardInstanceSkillsParticipantsListOutput,
  mapDashboardInstanceSkillsParticipantsListQuery,
  type DashboardInstanceSkillsParticipantsGetOutput,
  type DashboardInstanceSkillsParticipantsListOutput,
  type DashboardInstanceSkillsParticipantsListQuery
} from '../resources';

/**
 * @name Skill Participants controller
 * @description Inspect participants associated with an instance skill.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsParticipantsEndpoint {
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
   * @name List skill participants
   * @description Returns a paginated list of participants for a specific skill.
   *
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsParticipantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsParticipantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillId: string,
    query?: DashboardInstanceSkillsParticipantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsParticipantsListOutput> {
    let path = `skills/${skillId}/participants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsParticipantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsParticipantsListOutput
    );
  }

  /**
   * @name Get skill participant by ID
   * @description Retrieves a specific participant within a skill.
   *
   * @param `skillId` - string
   * @param `skillParticipantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsParticipantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    skillParticipantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsParticipantsGetOutput> {
    let path = `skills/${skillId}/participants/${skillParticipantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsParticipantsGetOutput
    );
  }
}
