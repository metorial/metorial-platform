import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationInstancesCreateBody,
  mapDashboardInstanceIntegrationInstancesCreateOutput,
  mapDashboardInstanceIntegrationInstancesCreateSessionBody,
  mapDashboardInstanceIntegrationInstancesCreateSessionOutput,
  mapDashboardInstanceIntegrationInstancesCreateSessionTemplateBody,
  mapDashboardInstanceIntegrationInstancesCreateSessionTemplateOutput,
  mapDashboardInstanceIntegrationInstancesDeleteOutput,
  mapDashboardInstanceIntegrationInstancesGetOutput,
  mapDashboardInstanceIntegrationInstancesListOutput,
  mapDashboardInstanceIntegrationInstancesListQuery,
  mapDashboardInstanceIntegrationInstancesUpdateBody,
  mapDashboardInstanceIntegrationInstancesUpdateOutput,
  type DashboardInstanceIntegrationInstancesCreateBody,
  type DashboardInstanceIntegrationInstancesCreateOutput,
  type DashboardInstanceIntegrationInstancesCreateSessionBody,
  type DashboardInstanceIntegrationInstancesCreateSessionOutput,
  type DashboardInstanceIntegrationInstancesCreateSessionTemplateBody,
  type DashboardInstanceIntegrationInstancesCreateSessionTemplateOutput,
  type DashboardInstanceIntegrationInstancesDeleteOutput,
  type DashboardInstanceIntegrationInstancesGetOutput,
  type DashboardInstanceIntegrationInstancesListOutput,
  type DashboardInstanceIntegrationInstancesListQuery,
  type DashboardInstanceIntegrationInstancesUpdateBody,
  type DashboardInstanceIntegrationInstancesUpdateOutput
} from '../resources';

/**
 * @name Integration Instances controller
 * @description Integration instances materialize an integration for a specific actor, identity, or runtime configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationInstancesEndpoint {
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
   * @param `query` - DashboardInstanceIntegrationInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesListOutput> {
    let path = `instances/${instanceId}/integration-instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstancesListOutput
    );
  }

  /**
   * @name Get integration instance
   * @description Retrieves a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesGetOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstancesGetOutput
    );
  }

  /**
   * @name Create integration instance session template
   * @description Creates or updates the shared session template for a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationInstancesCreateSessionTemplateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesCreateSessionTemplateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSessionTemplate(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationInstancesCreateSessionTemplateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesCreateSessionTemplateOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}/session-template`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstancesCreateSessionTemplateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstancesCreateSessionTemplateOutput
    );
  }

  /**
   * @name Create integration instance session
   * @description Creates a session from the shared session template of a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationInstancesCreateSessionBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesCreateSessionOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  createSession(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationInstancesCreateSessionBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesCreateSessionOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}/session`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstancesCreateSessionBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstancesCreateSessionOutput
    );
  }

  /**
   * @name Create integration instance
   * @description Creates a new integration instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesCreateOutput> {
    let path = `instances/${instanceId}/integration-instances`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstancesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationInstancesCreateOutput
    );
  }

  /**
   * @name Update integration instance
   * @description Updates a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `body` - DashboardInstanceIntegrationInstancesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationInstanceId: string,
    body: DashboardInstanceIntegrationInstancesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesUpdateOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstancesUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationInstancesUpdateOutput
    );
  }

  /**
   * @name Delete integration instance
   * @description Archives a specific integration instance.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstancesDeleteOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationInstancesDeleteOutput
    );
  }
}
