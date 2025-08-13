import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersCreateBody,
  mapDashboardInstanceCustomServersCreateOutput,
  mapDashboardInstanceCustomServersDeleteOutput,
  mapDashboardInstanceCustomServersGetOutput,
  mapDashboardInstanceCustomServersListOutput,
  mapDashboardInstanceCustomServersListQuery,
  mapDashboardInstanceCustomServersUpdateBody,
  mapDashboardInstanceCustomServersUpdateOutput,
  type DashboardInstanceCustomServersCreateBody,
  type DashboardInstanceCustomServersCreateOutput,
  type DashboardInstanceCustomServersDeleteOutput,
  type DashboardInstanceCustomServersGetOutput,
  type DashboardInstanceCustomServersListOutput,
  type DashboardInstanceCustomServersListQuery,
  type DashboardInstanceCustomServersUpdateBody,
  type DashboardInstanceCustomServersUpdateOutput
} from '../resources';

/**
 * @name Custom Server controller
 * @description Manager custom servers
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCustomServersEndpoint {
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
   * @name List custom servers
   * @description List all custom servers
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCustomServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCustomServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersListOutput> {
    let path = `instances/${instanceId}/custom-servers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersListOutput
    );
  }

  /**
   * @name Create custom server
   * @description Create a new custom server
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceCustomServersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceCustomServersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersCreateOutput> {
    let path = `instances/${instanceId}/custom-servers`;

    let request = {
      path,
      body: mapDashboardInstanceCustomServersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomServersCreateOutput
    );
  }

  /**
   * @name Update custom server
   * @description Update a custom server
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `body` - DashboardInstanceCustomServersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    customServerId: string,
    body: DashboardInstanceCustomServersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersUpdateOutput> {
    let path = `instances/${instanceId}/custom-servers/${customServerId}`;

    let request = {
      path,
      body: mapDashboardInstanceCustomServersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCustomServersUpdateOutput
    );
  }

  /**
   * @name Delete custom server
   * @description Delete a custom server
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    customServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersDeleteOutput> {
    let path = `instances/${instanceId}/custom-servers/${customServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceCustomServersDeleteOutput
    );
  }

  /**
   * @name Get custom server
   * @description Get information for a specific custom server
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersGetOutput> {
    let path = `instances/${instanceId}/custom-servers/${customServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersGetOutput
    );
  }
}
