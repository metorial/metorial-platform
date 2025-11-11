import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersVersionsCreateBody,
  mapDashboardInstanceCustomServersVersionsCreateOutput,
  mapDashboardInstanceCustomServersVersionsGetOutput,
  mapDashboardInstanceCustomServersVersionsListOutput,
  mapDashboardInstanceCustomServersVersionsListQuery,
  type DashboardInstanceCustomServersVersionsCreateBody,
  type DashboardInstanceCustomServersVersionsCreateOutput,
  type DashboardInstanceCustomServersVersionsGetOutput,
  type DashboardInstanceCustomServersVersionsListOutput,
  type DashboardInstanceCustomServersVersionsListQuery
} from '../resources';

/**
 * @name Custom Server controller
 * @description Manager custom server versions
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersVersionsEndpoint {
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
   * @name List custom server versions
   * @description List all custom server versions
   *
   * @param `customServerId` - string
   * @param `query` - DashboardInstanceCustomServersVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    customServerId: string,
    query?: DashboardInstanceCustomServersVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersVersionsListOutput> {
    let path = `custom-servers/${customServerId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersVersionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersVersionsListOutput
    );
  }

  /**
   * @name Create custom server version
   * @description Create a new custom server version
   *
   * @param `customServerId` - string
   * @param `body` - DashboardInstanceCustomServersVersionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersVersionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    customServerId: string,
    body: DashboardInstanceCustomServersVersionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersVersionsCreateOutput> {
    let path = `custom-servers/${customServerId}/versions`;

    let request = {
      path,
      body: mapDashboardInstanceCustomServersVersionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomServersVersionsCreateOutput
    );
  }

  /**
   * @name Get custom server version
   * @description Get information for a specific custom server version
   *
   * @param `customServerId` - string
   * @param `customServerVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    customServerId: string,
    customServerVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersVersionsGetOutput> {
    let path = `custom-servers/${customServerId}/versions/${customServerVersionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersVersionsGetOutput
    );
  }
}
