import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersVersionsCreateBody,
  mapDashboardInstanceCustomProvidersVersionsCreateOutput,
  mapDashboardInstanceCustomProvidersVersionsGetOutput,
  mapDashboardInstanceCustomProvidersVersionsListOutput,
  mapDashboardInstanceCustomProvidersVersionsListQuery,
  type DashboardInstanceCustomProvidersVersionsCreateBody,
  type DashboardInstanceCustomProvidersVersionsCreateOutput,
  type DashboardInstanceCustomProvidersVersionsGetOutput,
  type DashboardInstanceCustomProvidersVersionsListOutput,
  type DashboardInstanceCustomProvidersVersionsListQuery
} from '../resources';

/**
 * @name Custom Provider Versions controller
 * @description Versions represent different releases of a custom provider. Each version can be deployed to environments.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCustomProvidersVersionsEndpoint {
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
   * @name List custom provider versions
   * @description Returns a paginated list of versions for a custom provider.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCustomProvidersVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCustomProvidersVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersVersionsListOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomProvidersVersionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersVersionsListOutput
    );
  }

  /**
   * @name Get custom provider version
   * @description Retrieves a specific version of a custom provider.
   *
   * @param `instanceId` - string
   * @param `customProviderVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customProviderVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersVersionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-versions/${customProviderVersionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersVersionsGetOutput
    );
  }

  /**
   * @name Create custom provider version
   * @description Creates a new version for a custom provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceCustomProvidersVersionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersVersionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceCustomProvidersVersionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersVersionsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-versions`;

    let request = {
      path,
      body: mapDashboardInstanceCustomProvidersVersionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomProvidersVersionsCreateOutput
    );
  }
}
