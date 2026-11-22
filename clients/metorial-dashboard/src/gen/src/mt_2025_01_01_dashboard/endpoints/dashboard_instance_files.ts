import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFilesDeleteOutput,
  mapDashboardInstanceFilesGetOutput,
  mapDashboardInstanceFilesListOutput,
  mapDashboardInstanceFilesListQuery,
  type DashboardInstanceFilesDeleteOutput,
  type DashboardInstanceFilesGetOutput,
  type DashboardInstanceFilesListOutput,
  type DashboardInstanceFilesListQuery
} from '../resources';

/**
 * @name Files controller
 * @description A file is content uploaded to an instance, such as an image or an attachment. Its purpose controls what it can be linked to.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceFilesEndpoint {
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
   * @name List files
   * @description Returns a paginated list of files.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceFilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceFilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesListOutput> {
    let path = `dashboard/instances/${instanceId}/files`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceFilesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFilesListOutput);
  }

  /**
   * @name Get file
   * @description Retrieves a file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    fileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesGetOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFilesGetOutput);
  }

  /**
   * @name Delete file
   * @description Deletes a file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFilesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    fileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFilesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFilesDeleteOutput
    );
  }
}
