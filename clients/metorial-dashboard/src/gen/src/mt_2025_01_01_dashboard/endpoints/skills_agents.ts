import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsAgentsCreateBody,
  mapDashboardInstanceSkillsAgentsCreateOutput,
  mapDashboardInstanceSkillsAgentsDeleteOutput,
  mapDashboardInstanceSkillsAgentsGetOutput,
  mapDashboardInstanceSkillsAgentsListOutput,
  mapDashboardInstanceSkillsAgentsListQuery,
  mapDashboardInstanceSkillsAgentsUpdateBody,
  mapDashboardInstanceSkillsAgentsUpdateOutput,
  type DashboardInstanceSkillsAgentsCreateBody,
  type DashboardInstanceSkillsAgentsCreateOutput,
  type DashboardInstanceSkillsAgentsDeleteOutput,
  type DashboardInstanceSkillsAgentsGetOutput,
  type DashboardInstanceSkillsAgentsListOutput,
  type DashboardInstanceSkillsAgentsListQuery,
  type DashboardInstanceSkillsAgentsUpdateBody,
  type DashboardInstanceSkillsAgentsUpdateOutput
} from '../resources';

/**
 * @name Skill Agents controller
 * @description Manage sub-agents attached to a skill.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsAgentsEndpoint {
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
   * @name Create skill agent
   * @description Creates a new agent document in the skill agents directory.
   *
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsAgentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsAgentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    skillId: string,
    body: DashboardInstanceSkillsAgentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsAgentsCreateOutput> {
    let path = `skills/${skillId}/agents`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsAgentsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsAgentsCreateOutput
    );
  }

  /**
   * @name List skill agents
   * @description Returns a paginated list of agents for a specific skill.
   *
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsAgentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsAgentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillId: string,
    query?: DashboardInstanceSkillsAgentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsAgentsListOutput> {
    let path = `skills/${skillId}/agents`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsAgentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsAgentsListOutput
    );
  }

  /**
   * @name Get skill agent by ID
   * @description Retrieves a specific agent within a skill.
   *
   * @param `skillId` - string
   * @param `skillAgentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsAgentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    skillAgentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsAgentsGetOutput> {
    let path = `skills/${skillId}/agents/${skillAgentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsAgentsGetOutput
    );
  }

  /**
   * @name Update skill agent
   * @description Updates the name or description for a specific skill agent.
   *
   * @param `skillId` - string
   * @param `skillAgentId` - string
   * @param `body` - DashboardInstanceSkillsAgentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsAgentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillId: string,
    skillAgentId: string,
    body: DashboardInstanceSkillsAgentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsAgentsUpdateOutput> {
    let path = `skills/${skillId}/agents/${skillAgentId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsAgentsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsAgentsUpdateOutput
    );
  }

  /**
   * @name Delete skill agent
   * @description Archives a specific skill agent and removes its linked store item.
   *
   * @param `skillId` - string
   * @param `skillAgentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsAgentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillId: string,
    skillAgentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsAgentsDeleteOutput> {
    let path = `skills/${skillId}/agents/${skillAgentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsAgentsDeleteOutput
    );
  }
}
