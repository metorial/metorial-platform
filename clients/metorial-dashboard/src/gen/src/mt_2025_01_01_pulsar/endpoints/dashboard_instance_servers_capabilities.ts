import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersCapabilitiesListOutput,
  mapDashboardInstanceServersCapabilitiesListQuery,
  type DashboardInstanceServersCapabilitiesListOutput,
  type DashboardInstanceServersCapabilitiesListQuery
} from '../resources';

/**
 * @name Server Capabilities controller
 * @description Describes the capabilities, i.e., the tools, resources, and prompts, that certain servers support.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServersCapabilitiesEndpoint {
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
   * @name List server capabilities
   * @description Returns a list of server capabilities, filterable by server attributes such as deployment, variant, or version.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersCapabilitiesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersCapabilitiesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersCapabilitiesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersCapabilitiesListOutput> {
    let path = `dashboard/instances/${instanceId}/server-capabilities`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServersCapabilitiesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersCapabilitiesListOutput
    );
  }
}
