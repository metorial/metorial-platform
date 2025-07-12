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
 * @name FileLink controller
 * @description Read and write file link information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceLinksEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List file links
   * @description List all file links
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   *
   * @returns DashboardInstanceLinksListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    fileId: string
  ): Promise<DashboardInstanceLinksListOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}/links`;
    return this._get({
      path
    }).transform(mapDashboardInstanceLinksListOutput);
  }

  /**
   * @name Get file link
   * @description Get the information of a specific file link
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
  get(
    instanceId: string,
    fileId: string,
    linkId: string
  ): Promise<DashboardInstanceLinksGetOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}/links/${linkId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Create a new file link
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
  ): Promise<DashboardInstanceLinksCreateOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}/links`;
    return this._post({
      path,
      body: mapDashboardInstanceLinksCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksCreateOutput);
  }

  /**
   * @name Update file link
   * @description Update the information of a specific file link
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
  ): Promise<DashboardInstanceLinksUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}/links/${linkId}`;
    return this._patch({
      path,
      body: mapDashboardInstanceLinksUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceLinksUpdateOutput);
  }

  /**
   * @name Delete file link
   * @description Delete a specific file link
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
  delete(
    instanceId: string,
    fileId: string,
    linkId: string
  ): Promise<DashboardInstanceLinksDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/files/${fileId}/links/${linkId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceLinksDeleteOutput);
  }
}
