import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstancePublishersGetOutput,
  mapDashboardInstancePublishersListOutput,
  mapDashboardInstancePublishersListQuery,
  type DashboardInstancePublishersGetOutput,
  type DashboardInstancePublishersListOutput,
  type DashboardInstancePublishersListQuery
} from '../resources';

/**
 * @name Publishers controller
 * @description A publisher is the organization or individual who created and maintains a provider.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPublishersEndpoint {
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
   * @name List publishers
   * @description Returns a paginated list of publishers.
   *
   * @param `query` - DashboardInstancePublishersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublishersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstancePublishersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublishersListOutput> {
    let path = 'publishers';

    let request = {
      path,

      query: query ? mapDashboardInstancePublishersListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstancePublishersListOutput);
  }

  /**
   * @name Get publisher
   * @description Retrieves a specific publisher by ID.
   *
   * @param `publisherId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublishersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    publisherId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublishersGetOutput> {
    let path = `publishers/${publisherId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstancePublishersGetOutput);
  }
}
