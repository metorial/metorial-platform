import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

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
 * @name File controller
 * @description Read and write file information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialFilesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List  files
   * @description List all  files
   *
   * @param `query` - DashboardInstanceFilesListQuery
   *
   * @returns DashboardInstanceFilesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceFilesListQuery
  ): Promise<DashboardInstanceFilesListOutput> {
    let path = 'files';
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceFilesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceFilesListOutput);
  }

  /**
   * @name Get file
   * @description Get the information of a specific file
   *
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(fileId: string): Promise<DashboardInstanceFilesGetOutput> {
    let path = `files/${fileId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceFilesGetOutput);
  }

  /**
   * @name Update file
   * @description Update the information of a specific file
   *
   * @param `fileId` - string
   * @param `body` - DashboardInstanceFilesUpdateBody
   *
   * @returns DashboardInstanceFilesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    fileId: string,
    body: DashboardInstanceFilesUpdateBody
  ): Promise<DashboardInstanceFilesUpdateOutput> {
    let path = `files/${fileId}`;
    return this._patch({
      path,
      body: mapDashboardInstanceFilesUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceFilesUpdateOutput);
  }

  /**
   * @name Delete file
   * @description Delete a specific file
   *
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(fileId: string): Promise<DashboardInstanceFilesDeleteOutput> {
    let path = `files/${fileId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceFilesDeleteOutput);
  }
}
