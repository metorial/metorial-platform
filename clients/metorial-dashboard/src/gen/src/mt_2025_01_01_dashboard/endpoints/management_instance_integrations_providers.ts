import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsProvidersCreateBody,
  mapDashboardInstanceIntegrationsProvidersCreateOutput,
  mapDashboardInstanceIntegrationsProvidersDeleteOutput,
  mapDashboardInstanceIntegrationsProvidersGetOutput,
  mapDashboardInstanceIntegrationsProvidersListOutput,
  mapDashboardInstanceIntegrationsProvidersListQuery,
  mapDashboardInstanceIntegrationsProvidersUpdateBody,
  mapDashboardInstanceIntegrationsProvidersUpdateOutput,
  type DashboardInstanceIntegrationsProvidersCreateBody,
  type DashboardInstanceIntegrationsProvidersCreateOutput,
  type DashboardInstanceIntegrationsProvidersDeleteOutput,
  type DashboardInstanceIntegrationsProvidersGetOutput,
  type DashboardInstanceIntegrationsProvidersListOutput,
  type DashboardInstanceIntegrationsProvidersListQuery,
  type DashboardInstanceIntegrationsProvidersUpdateBody,
  type DashboardInstanceIntegrationsProvidersUpdateOutput
} from '../resources';

/**
 * @name Integration Providers controller
 * @description Integration providers define the shared provider-level contract for a given integration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationsProvidersEndpoint {
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
   * @param `query` - DashboardInstanceIntegrationsProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationsProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersListOutput> {
    let path = `instances/${instanceId}/integration-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsProvidersListOutput
    );
  }

  /**
   * @name Get integration provider
   * @description Retrieves a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersGetOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsProvidersGetOutput
    );
  }

  /**
   * @name Create integration provider
   * @description Creates a new integration provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationsProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationsProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersCreateOutput> {
    let path = `instances/${instanceId}/integration-providers`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsProvidersCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsProvidersCreateOutput
    );
  }

  /**
   * @name Update integration provider
   * @description Updates a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `body` - DashboardInstanceIntegrationsProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    integrationProviderId: string,
    body: DashboardInstanceIntegrationsProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersUpdateOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsProvidersUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIntegrationsProvidersUpdateOutput
    );
  }

  /**
   * @name Delete integration provider
   * @description Archives a specific integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersDeleteOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsProvidersDeleteOutput
    );
  }
}
