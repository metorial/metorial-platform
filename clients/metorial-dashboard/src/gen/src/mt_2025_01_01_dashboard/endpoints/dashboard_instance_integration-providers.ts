import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationProvidersCreateBody,
  mapDashboardInstanceIntegrationProvidersCreateOutput,
  mapDashboardInstanceIntegrationProvidersDeleteOutput,
  mapDashboardInstanceIntegrationProvidersGetOutput,
  mapDashboardInstanceIntegrationProvidersListOutput,
  mapDashboardInstanceIntegrationProvidersListQuery,
  mapDashboardInstanceIntegrationProvidersUpdateBody,
  mapDashboardInstanceIntegrationProvidersUpdateOutput,
  type DashboardInstanceIntegrationProvidersCreateBody,
  type DashboardInstanceIntegrationProvidersCreateOutput,
  type DashboardInstanceIntegrationProvidersDeleteOutput,
  type DashboardInstanceIntegrationProvidersGetOutput,
  type DashboardInstanceIntegrationProvidersListOutput,
  type DashboardInstanceIntegrationProvidersListQuery,
  type DashboardInstanceIntegrationProvidersUpdateBody,
  type DashboardInstanceIntegrationProvidersUpdateOutput
} from '../resources';

/**
 * @name Integration Providers controller
 * @description Integration providers define the shared provider-level contract for a given integration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationProvidersEndpoint {
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
   * @name List integration providers
   * @description Returns a paginated list of integration providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationProvidersListOutput> {
    let path = `dashboard/instances/${instanceId}/integration-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationProvidersListOutput
    );
  }

  /**
   * @name Get integration provider
   * @description Retrieves a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationProvidersGetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationProvidersGetOutput
    );
  }

  /**
   * @name Create integration provider
   * @description Creates a new integration provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationProvidersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-providers`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationProvidersCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationProvidersCreateOutput
    );
  }

  /**
   * @name Update integration provider
   * @description Updates a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `body` - DashboardInstanceIntegrationProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationProviderId: string,
    body: DashboardInstanceIntegrationProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationProvidersUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationProvidersUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationProvidersUpdateOutput
    );
  }

  /**
   * @name Delete integration provider
   * @description Archives a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationProvidersDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationProvidersDeleteOutput
    );
  }
}
