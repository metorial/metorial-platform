import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardFilesLinksCreateBody,
  mapDashboardFilesLinksCreateOutput,
  mapDashboardFilesLinksDeleteOutput,
  mapDashboardFilesLinksGetOutput,
  mapDashboardFilesLinksListOutput,
  mapDashboardFilesLinksUpdateBody,
  mapDashboardFilesLinksUpdateOutput,
  type DashboardFilesLinksCreateBody,
  type DashboardFilesLinksCreateOutput,
  type DashboardFilesLinksDeleteOutput,
  type DashboardFilesLinksGetOutput,
  type DashboardFilesLinksListOutput,
  type DashboardFilesLinksUpdateBody,
  type DashboardFilesLinksUpdateOutput
} from '../resources';

/**
 * @name FileLink controller
 * @description Read and write file link information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardFilesLinksEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List file links
   * @description List all file links
   *
   * @param `fileId` - string
   *
   * @returns DashboardFilesLinksListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(fileId: string) {
    return this._get({
      path: ['dashboard', 'files', fileId, 'links']
    }).transform(mapDashboardFilesLinksListOutput);
  }

  /**
   * @name Get file link
   * @description Get the information of a specific file link
   *
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardFilesLinksGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(fileId: string, linkId: string) {
    return this._get({
      path: ['dashboard', 'files', fileId, 'links', linkId]
    }).transform(mapDashboardFilesLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Create a new file link
   *
   * @param `fileId` - string
   * @param `body` - DashboardFilesLinksCreateBody
   *
   * @returns DashboardFilesLinksCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(fileId: string, body: DashboardFilesLinksCreateBody) {
    return this._post({
      path: ['dashboard', 'files', fileId, 'links'],
      body: mapDashboardFilesLinksCreateBody.transformTo(body)
    }).transform(mapDashboardFilesLinksCreateOutput);
  }

  /**
   * @name Update file link
   * @description Update the information of a specific file link
   *
   * @param `fileId` - string
   * @param `linkId` - string
   * @param `body` - DashboardFilesLinksUpdateBody
   *
   * @returns DashboardFilesLinksUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(fileId: string, linkId: string, body: DashboardFilesLinksUpdateBody) {
    return this._patch({
      path: ['dashboard', 'files', fileId, 'links', linkId],
      body: mapDashboardFilesLinksUpdateBody.transformTo(body)
    }).transform(mapDashboardFilesLinksUpdateOutput);
  }

  /**
   * @name Delete file link
   * @description Delete a specific file link
   *
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardFilesLinksDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(fileId: string, linkId: string) {
    return this._delete({
      path: ['dashboard', 'files', fileId, 'links', linkId]
    }).transform(mapDashboardFilesLinksDeleteOutput);
  }
}
