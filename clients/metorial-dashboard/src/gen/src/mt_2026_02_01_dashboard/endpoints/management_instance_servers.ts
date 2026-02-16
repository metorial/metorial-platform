import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersGetOutput,
  type DashboardInstanceServersGetOutput
} from '../resources';

/**
 * @name Servers controller
 * @description A server represents a deployable MCP server in Metorial's catalog. You can use server deployments to create MCP server instances that you can connect to.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersEndpoint {
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
   * @name Get server by ID
   * @description Retrieves detailed information for a server identified by its ID.
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersGetOutput> {
    let path = `instances/${instanceId}/servers/${serverId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceServersGetOutput);
  }
}
