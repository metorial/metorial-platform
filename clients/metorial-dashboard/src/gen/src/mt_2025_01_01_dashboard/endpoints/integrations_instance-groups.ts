import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsInstanceGroupsCreateBody,
  mapDashboardInstanceIntegrationsInstanceGroupsCreateOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionBody,
  mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateBody,
  mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsDeleteOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsGetOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsListOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsListQuery,
  mapDashboardInstanceIntegrationsInstanceGroupsUpdateBody,
  mapDashboardInstanceIntegrationsInstanceGroupsUpdateOutput,
  type DashboardInstanceIntegrationsInstanceGroupsCreateBody,
  type DashboardInstanceIntegrationsInstanceGroupsCreateOutput,
  type DashboardInstanceIntegrationsInstanceGroupsCreateSessionBody,
  type DashboardInstanceIntegrationsInstanceGroupsCreateSessionOutput,
  type DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateBody,
  type DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateOutput,
  type DashboardInstanceIntegrationsInstanceGroupsDeleteOutput,
  type DashboardInstanceIntegrationsInstanceGroupsGetOutput,
  type DashboardInstanceIntegrationsInstanceGroupsListOutput,
  type DashboardInstanceIntegrationsInstanceGroupsListQuery,
  type DashboardInstanceIntegrationsInstanceGroupsUpdateBody,
  type DashboardInstanceIntegrationsInstanceGroupsUpdateOutput
} from '../resources';

/**
 * @name Integration Instance Groups controller
 * @description Integration instance groups combine instance providers into a grouped routed configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIntegrationsInstanceGroupsEndpoint {
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
   * @param `query` - DashboardInstanceIntegrationsInstanceGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIntegrationsInstanceGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsListOutput> {
    let path = 'integration-instance-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsInstanceGroupsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsListOutput
    );
  }

  /**
   * @name Get integration instance group
   * @description Retrieves a specific integration instance group.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    integrationInstanceGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsGetOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsGetOutput
    );
  }

  /**
   * @name Create integration instance group session template
   * @description Creates or updates the shared session template for a specific integration instance group.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSessionTemplate(
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}/session-template`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionTemplateOutput
    );
  }

  /**
   * @name Create integration instance group session
   * @description Creates a session from the shared session template of a specific integration instance group.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationsInstanceGroupsCreateSessionBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsCreateSessionOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSession(
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationsInstanceGroupsCreateSessionBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsCreateSessionOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}/session`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsCreateSessionOutput
    );
  }

  /**
   * @name Create integration instance group
   * @description Creates a new integration instance group.
   *
   * @param `body` - DashboardInstanceIntegrationsInstanceGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIntegrationsInstanceGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsCreateOutput> {
    let path = 'integration-instance-groups';

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstanceGroupsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsCreateOutput
    );
  }

  /**
   * @name Update integration instance group
   * @description Updates a specific integration instance group.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `body` - DashboardInstanceIntegrationsInstanceGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    integrationInstanceGroupId: string,
    body: DashboardInstanceIntegrationsInstanceGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsUpdateOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstanceGroupsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsUpdateOutput
    );
  }

  /**
   * @name Delete integration instance group
   * @description Archives a specific integration instance group.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    integrationInstanceGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsDeleteOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsDeleteOutput
    );
  }
}
