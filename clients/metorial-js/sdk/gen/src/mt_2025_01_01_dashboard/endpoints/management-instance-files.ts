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
 * @name Files controller
 * @description Represents files that you have uploaded to Metorial. Files can be linked to various resources based on their purpose. Metorial can also automatically extract files for you, for example for data exports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceFilesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List instance files
   * @description Returns a paginated list of files owned by the instance.
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
   * @name Get file by ID
   * @description Retrieves details for a specific file by its ID.
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
   * @name Update file by ID
   * @description Updates editable fields of a specific file by its ID.
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
   * @name Delete file by ID
   * @description Deletes a specific file by its ID.
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
