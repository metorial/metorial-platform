import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderListingsGetOutput,
  mapDashboardInstanceProviderListingsListOutput,
  mapDashboardInstanceProviderListingsListQuery,
  type DashboardInstanceProviderListingsGetOutput,
  type DashboardInstanceProviderListingsListOutput,
  type DashboardInstanceProviderListingsListQuery
} from '../resources';

/**
 * @name Provider Listings controller
 * @description A listing is a provider enriched with marketplace metadata.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderListingsEndpoint {
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
   * @name List provider listings
   * @description Returns a paginated list of provider listings.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderListingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderListingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderListingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderListingsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-listings`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderListingsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderListingsListOutput
    );
  }

  /**
   * @name Get provider listing
   * @description Retrieves a specific provider listing by ID.
   *
   * @param `instanceId` - string
   * @param `providerListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderListingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderListingsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-listings/${providerListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderListingsGetOutput
    );
  }
}
