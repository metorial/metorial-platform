import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationInternetGatewayGetOutput,
  mapDashboardInstanceIntegrationInternetGatewayListNetworkLogsOutput,
  mapDashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery,
  type DashboardInstanceIntegrationInternetGatewayGetOutput,
  type DashboardInstanceIntegrationInternetGatewayListNetworkLogsOutput,
  type DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery
} from '../resources';

/**
 * @name Integration Internet Gateway controller
 * @description An integration internet gateway is the shared network exit for integration enclaves in an instance. Enclaves use it to reach the internet and be reached from it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationInternetGatewayEndpoint {
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
   * @name Get integration internet gateway
   * @description Retrieves the instance's integration internet gateway. Public IPs are masked as `x.x.x.x` unless your plan includes IP access.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInternetGatewayGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInternetGatewayGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/integration-internet-gateway`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInternetGatewayGetOutput
    );
  }

  /**
   * @name List integration internet gateway network logs
   * @description Returns network logs for integration enclaves in the instance. Set `direction` to choose ingress or egress logs.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInternetGatewayListNetworkLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  listNetworkLogs(
    instanceId: string,
    query?: DashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInternetGatewayListNetworkLogsOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/integration-internet-gateway/network-logs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationInternetGatewayListNetworkLogsQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInternetGatewayListNetworkLogsOutput
    );
  }
}
