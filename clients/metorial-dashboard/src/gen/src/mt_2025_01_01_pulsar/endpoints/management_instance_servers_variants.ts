import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersVariantsGetOutput,
  mapDashboardInstanceServersVariantsListOutput,
  mapDashboardInstanceServersVariantsListQuery,
  type DashboardInstanceServersVariantsGetOutput,
  type DashboardInstanceServersVariantsListOutput,
  type DashboardInstanceServersVariantsListQuery
} from '../resources';

/**
 * @name Server Variant controller
 * @description Server variants define different instances of a server, each with its own configuration and capabilities. By default, Metorial picks the best variant automatically, but you can specify a variant if needed.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersVariantsEndpoint {
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
   * @name List server variants
   * @description Retrieve all variants for a given server
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `query` - DashboardInstanceServersVariantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersVariantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    serverId: string,
    query?: DashboardInstanceServersVariantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersVariantsListOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/variants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServersVariantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersVariantsListOutput
    );
  }

  /**
   * @name Get server variant
   * @description Retrieve details for a specific server variant
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `serverVariantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersVariantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverId: string,
    serverVariantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersVariantsGetOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/variants/${serverVariantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersVariantsGetOutput
    );
  }
}
