import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsCreateBody,
  mapDashboardInstanceIntegrationsCreateOutput,
  mapDashboardInstanceIntegrationsDeleteOutput,
  mapDashboardInstanceIntegrationsGetOutput,
  mapDashboardInstanceIntegrationsListOutput,
  mapDashboardInstanceIntegrationsListQuery,
  mapDashboardInstanceIntegrationsUpdateBody,
  mapDashboardInstanceIntegrationsUpdateOutput,
  type DashboardInstanceIntegrationsCreateBody,
  type DashboardInstanceIntegrationsCreateOutput,
  type DashboardInstanceIntegrationsDeleteOutput,
  type DashboardInstanceIntegrationsGetOutput,
  type DashboardInstanceIntegrationsListOutput,
  type DashboardInstanceIntegrationsListQuery,
  type DashboardInstanceIntegrationsUpdateBody,
  type DashboardInstanceIntegrationsUpdateOutput
} from '../resources';

/**
 * @name Integrations controller
 * @description Integrations define reusable provider contracts that can then be materialized into integration instances.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationsEndpoint {
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
   * @name List integrations
   * @description Returns a paginated list of integrations.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsListOutput> {
    let path = `dashboard/instances/${instanceId}/integrations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsListOutput
    );
  }

  /**
   * @name Get integration
   * @description Retrieves a specific integration.
   *
   * @param `instanceId` - string
   * @param `integrationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsGetOutput> {
    let path = `dashboard/instances/${instanceId}/integrations/${integrationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsGetOutput
    );
  }

  /**
   * @name Create integration
   * @description Creates a new integration.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/integrations`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsCreateOutput
    );
  }

  /**
   * @name Update integration
   * @description Updates a specific integration.
   *
   * @param `instanceId` - string
   * @param `integrationId` - string
   * @param `body` - DashboardInstanceIntegrationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationId: string,
    body: DashboardInstanceIntegrationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/integrations/${integrationId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationsUpdateOutput
    );
  }

  /**
   * @name Delete integration
   * @description Archives a specific integration.
   *
   * @param `instanceId` - string
   * @param `integrationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/integrations/${integrationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsDeleteOutput
    );
  }
}
