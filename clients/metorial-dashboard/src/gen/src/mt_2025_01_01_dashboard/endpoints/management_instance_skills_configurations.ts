import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsConfigurationsCreateBody,
  mapDashboardInstanceSkillsConfigurationsCreateOutput,
  mapDashboardInstanceSkillsConfigurationsDeleteOutput,
  mapDashboardInstanceSkillsConfigurationsGetOutput,
  mapDashboardInstanceSkillsConfigurationsListOutput,
  mapDashboardInstanceSkillsConfigurationsListQuery,
  mapDashboardInstanceSkillsConfigurationsUpdateBody,
  mapDashboardInstanceSkillsConfigurationsUpdateOutput,
  type DashboardInstanceSkillsConfigurationsCreateBody,
  type DashboardInstanceSkillsConfigurationsCreateOutput,
  type DashboardInstanceSkillsConfigurationsDeleteOutput,
  type DashboardInstanceSkillsConfigurationsGetOutput,
  type DashboardInstanceSkillsConfigurationsListOutput,
  type DashboardInstanceSkillsConfigurationsListQuery,
  type DashboardInstanceSkillsConfigurationsUpdateBody,
  type DashboardInstanceSkillsConfigurationsUpdateOutput
} from '../resources';

/**
 * @name Skill Configurations controller
 * @description Manage configuration profiles for skill execution.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsConfigurationsEndpoint {
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
   * @name Create skill configuration
   * @description Creates a new non-default skill configuration.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillsConfigurationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsConfigurationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillsConfigurationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsConfigurationsCreateOutput> {
    let path = `instances/${instanceId}/skills/configurations`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsConfigurationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsConfigurationsCreateOutput
    );
  }

  /**
   * @name List skill configurations
   * @description Returns a paginated list of visible skill configurations.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillsConfigurationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsConfigurationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillsConfigurationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsConfigurationsListOutput> {
    let path = `instances/${instanceId}/skills/configurations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsConfigurationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsConfigurationsListOutput
    );
  }

  /**
   * @name Get skill configuration
   * @description Retrieves a specific skill configuration by ID, or the default.
   *
   * @param `instanceId` - string
   * @param `skillConfigurationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsConfigurationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillConfigurationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsConfigurationsGetOutput> {
    let path = `instances/${instanceId}/skills/configurations/${skillConfigurationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsConfigurationsGetOutput
    );
  }

  /**
   * @name Update skill configuration
   * @description Updates a specific skill configuration. Updating default creates it first if needed.
   *
   * @param `instanceId` - string
   * @param `skillConfigurationId` - string
   * @param `body` - DashboardInstanceSkillsConfigurationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsConfigurationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillConfigurationId: string,
    body: DashboardInstanceSkillsConfigurationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsConfigurationsUpdateOutput> {
    let path = `instances/${instanceId}/skills/configurations/${skillConfigurationId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsConfigurationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsConfigurationsUpdateOutput
    );
  }

  /**
   * @name Delete skill configuration
   * @description Soft deletes a specific non-internal skill configuration.
   *
   * @param `instanceId` - string
   * @param `skillConfigurationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsConfigurationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillConfigurationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsConfigurationsDeleteOutput> {
    let path = `instances/${instanceId}/skills/configurations/${skillConfigurationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsConfigurationsDeleteOutput
    );
  }
}
