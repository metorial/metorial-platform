import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardFilesDeleteOutput,
  mapDashboardFilesGetOutput,
  mapDashboardFilesListOutput,
  mapDashboardFilesListQuery,
  mapDashboardFilesUpdateBody,
  mapDashboardFilesUpdateOutput,
  type DashboardFilesDeleteOutput,
  type DashboardFilesGetOutput,
  type DashboardFilesListOutput,
  type DashboardFilesListQuery,
  type DashboardFilesUpdateBody,
  type DashboardFilesUpdateOutput
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
   * @param `query` - DashboardFilesListQuery
   *
   * @returns DashboardFilesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardFilesListQuery) {
    return this._get({
      path: ['files'],

      query: query ? mapDashboardFilesListQuery.transformTo(query) : undefined
    }).transform(mapDashboardFilesListOutput);
  }

  /**
   * @name Get file
   * @description Get the information of a specific file
   *
   * @param `fileId` - string
   *
   * @returns DashboardFilesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(fileId: string) {
    return this._get({
      path: ['files', fileId]
    }).transform(mapDashboardFilesGetOutput);
  }

  /**
   * @name Update file
   * @description Update the information of a specific file
   *
   * @param `fileId` - string
   * @param `body` - DashboardFilesUpdateBody
   *
   * @returns DashboardFilesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(fileId: string, body: DashboardFilesUpdateBody) {
    return this._patch({
      path: ['files', fileId],
      body: mapDashboardFilesUpdateBody.transformTo(body)
    }).transform(mapDashboardFilesUpdateOutput);
  }

  /**
   * @name Delete file
   * @description Delete a specific file
   *
   * @param `fileId` - string
   *
   * @returns DashboardFilesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(fileId: string) {
    return this._delete({
      path: ['files', fileId]
    }).transform(mapDashboardFilesDeleteOutput);
  }
}
