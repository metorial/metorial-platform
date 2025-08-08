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
export class MetorialLinksEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List file links
   * @description Returns a list of links associated with a specific file.
   *
   * @param `fileId` - string
   *
   * @returns DashboardInstanceLinksListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(fileId: string): Promise<DashboardInstanceLinksListOutput> {
    let path = `files/${fileId}/links`;
    return this._get({
      path
    }).transform(mapDashboardInstanceLinksListOutput);
  }

  /**
   * @name Get file link by ID
   * @description Retrieves the details of a specific file link by its ID.
   *
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardInstanceLinksGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    fileId: string,
    linkId: string
  ): Promise<DashboardInstanceLinksGetOutput> {
    let path = `files/${fileId}/links/${linkId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Creates a new link for a specific file.
   *
   * @param `fileId` - string
   * @param `body` - DashboardInstanceLinksCreateBody
   *
   * @returns DashboardInstanceLinksCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    fileId: string,
    body: DashboardInstanceLinksCreateBody
  ): Promise<DashboardInstanceLinksCreateOutput> {
    let path = `files/${fileId}/links`;
    return this._post({
      path,
      body: mapDashboardInstanceLinksCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksCreateOutput);
  }

  /**
   * @name Update file link by ID
   * @description Updates a file link’s properties, such as expiration.
   *
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
    fileId: string,
    linkId: string,
    body: DashboardInstanceLinksUpdateBody
  ): Promise<DashboardInstanceLinksUpdateOutput> {
    let path = `files/${fileId}/links/${linkId}`;
    return this._patch({
      path,
      body: mapDashboardInstanceLinksUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksUpdateOutput);
  }

  /**
   * @name Delete file link by ID
   * @description Deletes a specific file link by its ID.
   *
   * @param `fileId` - string
   * @param `linkId` - string
   *
   * @returns DashboardInstanceLinksDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    fileId: string,
    linkId: string
  ): Promise<DashboardInstanceLinksDeleteOutput> {
    let path = `files/${fileId}/links/${linkId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceLinksDeleteOutput);
  }
}
