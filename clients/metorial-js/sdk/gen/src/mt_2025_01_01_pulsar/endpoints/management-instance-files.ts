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
export class MetorialManagementInstanceFilesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List  files
   * @description List all  files
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceFilesListQuery
   *
   * @returns DashboardInstanceFilesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceFilesListQuery) {
    return this._get({
      path: ['instances', instanceId, 'files'],

      query: query
        ? mapDashboardInstanceFilesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceFilesListOutput);
  }

  /**
   * @name Get file
   * @description Get the information of a specific file
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, fileId: string) {
    return this._get({
      path: ['instances', instanceId, 'files', fileId]
    }).transform(mapDashboardInstanceFilesGetOutput);
  }

  /**
   * @name Update file
   * @description Update the information of a specific file
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `body` - DashboardInstanceFilesUpdateBody
   *
   * @returns DashboardInstanceFilesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    fileId: string,
    body: DashboardInstanceFilesUpdateBody
  ) {
    return this._patch({
      path: ['instances', instanceId, 'files', fileId],
      body: mapDashboardInstanceFilesUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceFilesUpdateOutput);
  }

  /**
   * @name Delete file
   * @description Delete a specific file
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, fileId: string) {
    return this._delete({
      path: ['instances', instanceId, 'files', fileId]
    }).transform(mapDashboardInstanceFilesDeleteOutput);
  }
}
