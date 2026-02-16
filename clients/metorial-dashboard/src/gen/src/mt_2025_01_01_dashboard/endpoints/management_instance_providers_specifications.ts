import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersSpecificationsGetOutput,
  mapDashboardInstanceProvidersSpecificationsListOutput,
  mapDashboardInstanceProvidersSpecificationsListQuery,
  type DashboardInstanceProvidersSpecificationsGetOutput,
  type DashboardInstanceProvidersSpecificationsListOutput,
  type DashboardInstanceProvidersSpecificationsListQuery
} from '../resources';

/**
 * @name Provider Specifications controller
 * @description A specification defines what a provider version can do: its tools, auth methods, and required configuration fields.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProvidersSpecificationsEndpoint {
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
   * @name List provider specifications
   * @description Returns a paginated list of provider specifications.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `query` - DashboardInstanceProvidersSpecificationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersSpecificationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerId: string,
    query?: DashboardInstanceProvidersSpecificationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersSpecificationsListOutput> {
    let path = `instances/${instanceId}/providers/${providerId}/specifications`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersSpecificationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersSpecificationsListOutput
    );
  }

  /**
   * @name Get provider specification
   * @description Retrieves a specific provider specification by ID.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `providerSpecificationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersSpecificationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerId: string,
    providerSpecificationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersSpecificationsGetOutput> {
    let path = `instances/${instanceId}/providers/${providerId}/specifications/${providerSpecificationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersSpecificationsGetOutput
    );
  }
}
