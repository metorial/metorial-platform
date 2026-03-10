import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFileLinksCreateBody,
  mapDashboardInstanceFileLinksCreateOutput,
  mapDashboardInstanceFileLinksDeleteOutput,
  mapDashboardInstanceFileLinksGetOutput,
  mapDashboardInstanceFileLinksListOutput,
  mapDashboardInstanceFileLinksListQuery,
  type DashboardInstanceFileLinksCreateBody,
  type DashboardInstanceFileLinksCreateOutput,
  type DashboardInstanceFileLinksDeleteOutput,
  type DashboardInstanceFileLinksGetOutput,
  type DashboardInstanceFileLinksListOutput,
  type DashboardInstanceFileLinksListQuery
} from '../resources';

/**
 * @name File Links controller
 * @description Files are private by default. If you want to share a file, you can create a link for it. Links are public and do not require authentication to access, so be careful with what you share.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceFileLinksEndpoint {
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
   * @name List file links
   * @description Returns a paginated list of file links owned by the instance organization.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceFileLinksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFileLinksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceFileLinksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFileLinksListOutput> {
    let path = `dashboard/instances/${instanceId}/file-links`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceFileLinksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFileLinksListOutput
    );
  }

  /**
   * @name Get file link by ID
   * @description Retrieves the details of a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFileLinksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFileLinksGetOutput> {
    let path = `dashboard/instances/${instanceId}/file-links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFileLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Creates a new link for a specific file.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceFileLinksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFileLinksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceFileLinksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFileLinksCreateOutput> {
    let path = `dashboard/instances/${instanceId}/file-links`;

    let request = {
      path,
      body: mapDashboardInstanceFileLinksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceFileLinksCreateOutput
    );
  }

  /**
   * @name Delete file link by ID
   * @description Deletes a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFileLinksDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFileLinksDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/file-links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFileLinksDeleteOutput
    );
  }
}
