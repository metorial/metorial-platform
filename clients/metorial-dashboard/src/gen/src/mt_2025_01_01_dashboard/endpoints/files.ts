import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFilesDeleteOutput,
  mapDashboardInstanceFilesGetOutput,
  mapDashboardInstanceFilesListOutput,
  mapDashboardInstanceFilesListQuery,
  mapDashboardInstanceFilesUpdateBody,
  mapDashboardInstanceFilesUpdateOutput,
  type DashboardInstanceFilesDeleteOutput,
  type DashboardInstanceFilesGetOutput,
  type DashboardInstanceFilesListOutput,
  type DashboardInstanceFilesListQuery,
  type DashboardInstanceFilesUpdateBody,
  type DashboardInstanceFilesUpdateOutput
} from '../resources';

/**
 * @name Files controller
 * @description Represents files that you have uploaded to Metorial. Files can be linked to various resources based on their purpose. Metorial can also automatically extract files for you, for example for data exports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialFilesEndpoint {
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
   * @name List instance files
   * @description Returns a paginated list of files owned by the instance.
   *
   * @param `query` - DashboardInstanceFilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceFilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesListOutput> {
    let path = 'files';

    let request = {
      path,

      query: query ? mapDashboardInstanceFilesListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFilesListOutput);
  }

  /**
   * @name Get file by ID
   * @description Retrieves details for a specific file by its ID.
   *
   * @param `fileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    fileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesGetOutput> {
    let path = `files/${fileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFilesGetOutput);
  }

  /**
   * @name Update file by ID
   * @description Updates editable fields of a specific file by its ID.
   *
   * @param `fileId` - string
   * @param `body` - DashboardInstanceFilesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    fileId: string,
    body: DashboardInstanceFilesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesUpdateOutput> {
    let path = `files/${fileId}`;

    let request = {
      path,
      body: mapDashboardInstanceFilesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceFilesUpdateOutput);
  }

  /**
   * @name Delete file by ID
   * @description Deletes a specific file by its ID.
   *
   * @param `fileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    fileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesDeleteOutput> {
    let path = `files/${fileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardInstanceFilesDeleteOutput);
  }
}
