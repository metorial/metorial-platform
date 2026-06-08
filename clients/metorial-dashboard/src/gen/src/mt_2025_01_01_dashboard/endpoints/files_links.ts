import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFilesLinksCreateBody,
  mapDashboardInstanceFilesLinksCreateOutput,
  mapDashboardInstanceFilesLinksDeleteOutput,
  mapDashboardInstanceFilesLinksGetOutput,
  mapDashboardInstanceFilesLinksListOutput,
  mapDashboardInstanceFilesLinksListQuery,
  type DashboardInstanceFilesLinksCreateBody,
  type DashboardInstanceFilesLinksCreateOutput,
  type DashboardInstanceFilesLinksDeleteOutput,
  type DashboardInstanceFilesLinksGetOutput,
  type DashboardInstanceFilesLinksListOutput,
  type DashboardInstanceFilesLinksListQuery
} from '../resources';

/**
 * @name File Links controller
 * @description Files are private by default. If you want to share a file, you can create a link for it. Links are public and do not require authentication to access, so be careful with what you share.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialFilesLinksEndpoint {
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
   * @param `query` - DashboardInstanceFilesLinksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesLinksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceFilesLinksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesLinksListOutput> {
    let path = 'file-links';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceFilesLinksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFilesLinksListOutput
    );
  }

  /**
   * @name Get file link by ID
   * @description Retrieves the details of a specific file link by its ID.
   *
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesLinksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesLinksGetOutput> {
    let path = `file-links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFilesLinksGetOutput
    );
  }

  /**
   * @name Create file link
   * @description Creates a new link for a specific file.
   *
   * @param `body` - DashboardInstanceFilesLinksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesLinksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceFilesLinksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesLinksCreateOutput> {
    let path = 'file-links';

    let request = {
      path,
      body: mapDashboardInstanceFilesLinksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceFilesLinksCreateOutput
    );
  }

  /**
   * @name Delete file link by ID
   * @description Deletes a specific file link by its ID.
   *
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesLinksDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesLinksDeleteOutput> {
    let path = `file-links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFilesLinksDeleteOutput
    );
  }
}
