import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationInstanceGroupsCreateBody,
  mapDashboardInstanceIntegrationInstanceGroupsCreateOutput,
  mapDashboardInstanceIntegrationInstanceGroupsCreateSessionBody,
  mapDashboardInstanceIntegrationInstanceGroupsCreateSessionOutput,
  mapDashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateBody,
  mapDashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateOutput,
  mapDashboardInstanceIntegrationInstanceGroupsDeleteOutput,
  mapDashboardInstanceIntegrationInstanceGroupsGetOutput,
  mapDashboardInstanceIntegrationInstanceGroupsListOutput,
  mapDashboardInstanceIntegrationInstanceGroupsListQuery,
  mapDashboardInstanceIntegrationInstanceGroupsUpdateBody,
  mapDashboardInstanceIntegrationInstanceGroupsUpdateOutput,
  type DashboardInstanceIntegrationInstanceGroupsCreateBody,
  type DashboardInstanceIntegrationInstanceGroupsCreateOutput,
  type DashboardInstanceIntegrationInstanceGroupsCreateSessionBody,
  type DashboardInstanceIntegrationInstanceGroupsCreateSessionOutput,
  type DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateBody,
  type DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateOutput,
  type DashboardInstanceIntegrationInstanceGroupsDeleteOutput,
  type DashboardInstanceIntegrationInstanceGroupsGetOutput,
  type DashboardInstanceIntegrationInstanceGroupsListOutput,
  type DashboardInstanceIntegrationInstanceGroupsListQuery,
  type DashboardInstanceIntegrationInstanceGroupsUpdateBody,
  type DashboardInstanceIntegrationInstanceGroupsUpdateOutput
} from '../resources';

/**
 * @name Integration Instance Groups controller
 * @description Integration instance groups combine instance providers into a grouped routed configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationInstanceGroupsEndpoint {
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
   * @name List integration instance groups
   * @description Returns a paginated list of integration instance groups.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationInstanceGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationInstanceGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsListOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationInstanceGroupsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsListOutput
    );
  }

  /**
   * @name Get integration instance group
   * @description Retrieves a specific integration instance group.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsGetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsGetOutput
    );
  }

  /**
   * @name Create integration instance group session template
   * @description Creates or updates the shared session template for a specific integration instance group.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSessionTemplate(
    instanceId: string,
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}/session-template`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsCreateSessionTemplateOutput
    );
  }

  /**
   * @name Create integration instance group session
   * @description Creates a session from the shared session template of a specific integration instance group.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceGroupsCreateSessionBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsCreateSessionOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSession(
    instanceId: string,
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationInstanceGroupsCreateSessionBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsCreateSessionOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}/session`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceGroupsCreateSessionBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsCreateSessionOutput
    );
  }

  /**
   * @name Create integration instance group
   * @description Creates a new integration instance group.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationInstanceGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceGroupsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsCreateOutput
    );
  }

  /**
   * @name Update integration instance group
   * @description Updates a specific integration instance group.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationInstanceGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceGroupsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsUpdateOutput
    );
  }

  /**
   * @name Delete integration instance group
   * @description Archives a specific integration instance group.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationInstanceGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupsDeleteOutput
    );
  }
}
