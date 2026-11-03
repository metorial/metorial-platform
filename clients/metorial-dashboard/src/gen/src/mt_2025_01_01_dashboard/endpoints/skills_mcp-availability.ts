import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMcpAvailabilityGetOutput,
  type DashboardInstanceSkillsMcpAvailabilityGetOutput
} from '../resources';

/**
 * @name Skill Files controller
 * @description Read and edit the files of a skill by path.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMcpAvailabilityEndpoint {
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
   * @name Get skill MCP availability
   * @description Returns whether apps connected over MCP can see the skill. Skills with too many files or too large a total size are left out of MCP connections and keep working everywhere else.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMcpAvailabilityGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMcpAvailabilityGetOutput> {
    let path = `skills/${skillId}/mcp-availability`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMcpAvailabilityGetOutput
    );
  }
}
