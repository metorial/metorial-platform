import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceNetworksGetOutput,
  mapDashboardInstanceNetworksListNetworkLogsOutput,
  mapDashboardInstanceNetworksListNetworkLogsQuery,
  mapDashboardInstanceNetworksListOutput,
  mapDashboardInstanceNetworksListQuery,
  type DashboardInstanceNetworksGetOutput,
  type DashboardInstanceNetworksListNetworkLogsOutput,
  type DashboardInstanceNetworksListNetworkLogsQuery,
  type DashboardInstanceNetworksListOutput,
  type DashboardInstanceNetworksListQuery
} from '../resources';

/**
 * @name Networks controller
 * @description Read network records for an instance environment.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceNetworksEndpoint {
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
   * @name List networks
   * @description Returns a paginated list of networks.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceNetworksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceNetworksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworksListOutput> {
    let path = `dashboard/instances/${instanceId}/networks`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceNetworksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceNetworksListOutput);
  }

  /**
   * @name Get network
   * @description Retrieves a specific network by ID.
   *
   * @param `instanceId` - string
   * @param `networkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    networkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworksGetOutput> {
    let path = `dashboard/instances/${instanceId}/networks/${networkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceNetworksGetOutput);
  }

  /**
   * @name List network logs
   * @description Returns ingress or egress network logs for enclaves in the instance environment.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceNetworksListNetworkLogsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworksListNetworkLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  listNetworkLogs(
    instanceId: string,
    query?: DashboardInstanceNetworksListNetworkLogsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworksListNetworkLogsOutput> {
    let path = `dashboard/instances/${instanceId}/network-logs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceNetworksListNetworkLogsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceNetworksListNetworkLogsOutput
    );
  }
}
