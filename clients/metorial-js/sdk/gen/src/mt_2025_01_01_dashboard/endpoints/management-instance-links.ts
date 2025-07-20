import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceLinksCreateBody,
  mapDashboardInstanceLinksCreateOutput,
  mapDashboardInstanceLinksDeleteOutput,
  mapDashboardInstanceLinksGetOutput,
  mapDashboardInstanceLinksListOutput,
  mapDashboardInstanceLinksUpdateBody,
  mapDashboardInstanceLinksUpdateOutput,
  type DashboardInstanceLinksCreateBody,
  type DashboardInstanceLinksCreateOutput,
  type DashboardInstanceLinksDeleteOutput,
  type DashboardInstanceLinksGetOutput,
  type DashboardInstanceLinksListOutput,
  type DashboardInstanceLinksUpdateBody,
  type DashboardInstanceLinksUpdateOutput
} from '../resources';

/**
 * @name File Links controller
 * @description Files are private by default. If you want to share a file, you can create a link for it. Links are public and do not require authentication to access, so be careful with what you share.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceLinksEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List file links
   * @description Returns a list of links associated with a specific file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   *
   * @returns DashboardInstanceLinksListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, fileId: string) {
    return this._get({
      path: ['instances', instanceId, 'files', fileId, 'links']
    }).transform(mapDashboardInstanceLinksListOutput);
  }

  /**
   * @name Get file link by ID
   * @description Retrieves the details of a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardInstanceLinksGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, fileId: string, linkId: string) {
    return this._get({
      path: ['instances', instanceId, 'files', fileId, 'links', linkId]
    }).transform(mapDashboardInstanceLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Creates a new link for a specific file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `body` - DashboardInstanceLinksCreateBody
   *
   * @returns DashboardInstanceLinksCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    fileId: string,
    body: DashboardInstanceLinksCreateBody
  ) {
    return this._post({
      path: ['instances', instanceId, 'files', fileId, 'links'],
      body: mapDashboardInstanceLinksCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksCreateOutput);
  }

  /**
   * @name Update file link by ID
   * @description Updates a file link’s properties, such as expiration.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   * @param `body` - DashboardInstanceLinksUpdateBody
   *
   * @returns DashboardInstanceLinksUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    fileId: string,
    linkId: string,
    body: DashboardInstanceLinksUpdateBody
  ) {
    return this._patch({
      path: ['instances', instanceId, 'files', fileId, 'links', linkId],
      body: mapDashboardInstanceLinksUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksUpdateOutput);
  }

  /**
   * @name Delete file link by ID
   * @description Deletes a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardInstanceLinksDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, fileId: string, linkId: string) {
    return this._delete({
      path: ['instances', instanceId, 'files', fileId, 'links', linkId]
    }).transform(mapDashboardInstanceLinksDeleteOutput);
  }
}
