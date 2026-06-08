import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsInstancesCreateBody,
  mapDashboardInstanceIntegrationsInstancesCreateOutput,
  mapDashboardInstanceIntegrationsInstancesCreateSessionBody,
  mapDashboardInstanceIntegrationsInstancesCreateSessionOutput,
  mapDashboardInstanceIntegrationsInstancesCreateSessionTemplateBody,
  mapDashboardInstanceIntegrationsInstancesCreateSessionTemplateOutput,
  mapDashboardInstanceIntegrationsInstancesDeleteOutput,
  mapDashboardInstanceIntegrationsInstancesGetOutput,
  mapDashboardInstanceIntegrationsInstancesListOutput,
  mapDashboardInstanceIntegrationsInstancesListQuery,
  mapDashboardInstanceIntegrationsInstancesUpdateBody,
  mapDashboardInstanceIntegrationsInstancesUpdateOutput,
  type DashboardInstanceIntegrationsInstancesCreateBody,
  type DashboardInstanceIntegrationsInstancesCreateOutput,
  type DashboardInstanceIntegrationsInstancesCreateSessionBody,
  type DashboardInstanceIntegrationsInstancesCreateSessionOutput,
  type DashboardInstanceIntegrationsInstancesCreateSessionTemplateBody,
  type DashboardInstanceIntegrationsInstancesCreateSessionTemplateOutput,
  type DashboardInstanceIntegrationsInstancesDeleteOutput,
  type DashboardInstanceIntegrationsInstancesGetOutput,
  type DashboardInstanceIntegrationsInstancesListOutput,
  type DashboardInstanceIntegrationsInstancesListQuery,
  type DashboardInstanceIntegrationsInstancesUpdateBody,
  type DashboardInstanceIntegrationsInstancesUpdateOutput
} from '../resources';

/**
 * @name Integration Instances controller
 * @description Integration instances materialize an integration for a specific actor, identity, or runtime configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationsInstancesEndpoint {
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
   * @name List integration instances
   * @description Returns a paginated list of integration instances.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationsInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationsInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesListOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstancesListOutput
    );
  }

  /**
   * @name Get integration instance
   * @description Retrieves a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesGetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstancesGetOutput
    );
  }

  /**
   * @name Create integration instance session template
   * @description Creates or updates the shared session template for a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationsInstancesCreateSessionTemplateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesCreateSessionTemplateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSessionTemplate(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationsInstancesCreateSessionTemplateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesCreateSessionTemplateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}/session-template`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstancesCreateSessionTemplateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstancesCreateSessionTemplateOutput
    );
  }

  /**
   * @name Create integration instance session
   * @description Creates a session from the shared session template of a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationsInstancesCreateSessionBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesCreateSessionOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSession(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationsInstancesCreateSessionBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesCreateSessionOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}/session`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstancesCreateSessionBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstancesCreateSessionOutput
    );
  }

  /**
   * @name Create integration instance
   * @description Creates a new integration instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationsInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationsInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstancesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsInstancesCreateOutput
    );
  }

  /**
   * @name Update integration instance
   * @description Updates a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationsInstancesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationsInstancesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstancesUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationsInstancesUpdateOutput
    );
  }

  /**
   * @name Delete integration instance
   * @description Archives a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsInstancesDeleteOutput
    );
  }
}
