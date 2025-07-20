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
export class MetorialFilesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List instance files
   * @description Returns a paginated list of files owned by the instance.
   *
   * @param `query` - DashboardInstanceFilesListQuery
   *
   * @returns DashboardInstanceFilesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceFilesListQuery) {
    return this._get({
      path: ['files'],

      query: query
        ? mapDashboardInstanceFilesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceFilesListOutput);
  }

  /**
   * @name Get file by ID
   * @description Retrieves details for a specific file by its ID.
   *
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(fileId: string) {
    return this._get({
      path: ['files', fileId]
    }).transform(mapDashboardInstanceFilesGetOutput);
  }

  /**
   * @name Update file by ID
   * @description Updates editable fields of a specific file by its ID.
   *
   * @param `fileId` - string
   * @param `body` - DashboardInstanceFilesUpdateBody
   *
   * @returns DashboardInstanceFilesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(fileId: string, body: DashboardInstanceFilesUpdateBody) {
    return this._patch({
      path: ['files', fileId],
      body: mapDashboardInstanceFilesUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceFilesUpdateOutput);
  }

  /**
   * @name Delete file by ID
   * @description Deletes a specific file by its ID.
   *
   * @param `fileId` - string
   *
   * @returns DashboardInstanceFilesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(fileId: string) {
    return this._delete({
      path: ['files', fileId]
    }).transform(mapDashboardInstanceFilesDeleteOutput);
  }
}
