import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

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
export class MetorialManagementInstanceLinksEndpoint {
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
   * @name List file links
   * @description Returns a list of links associated with a specific file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceLinksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    fileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceLinksListOutput> {
    let path = `instances/${instanceId}/files/${fileId}/links`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceLinksListOutput);
  }

  /**
   * @name Get file link by ID
   * @description Retrieves the details of a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceLinksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    fileId: string,
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceLinksGetOutput> {
    let path = `instances/${instanceId}/files/${fileId}/links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceLinksGetOutput);
  }

  /**
   * @name Create file link
   * @description Creates a new link for a specific file.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `body` - DashboardInstanceLinksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceLinksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    fileId: string,
    body: DashboardInstanceLinksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceLinksCreateOutput> {
    let path = `instances/${instanceId}/files/${fileId}/links`;

    let request = {
      path,
      body: mapDashboardInstanceLinksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceLinksCreateOutput);
  }

  /**
   * @name Update file link by ID
   * @description Updates a file link’s properties, such as expiration.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   * @param `body` - DashboardInstanceLinksUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceLinksUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    fileId: string,
    linkId: string,
    body: DashboardInstanceLinksUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceLinksUpdateOutput> {
    let path = `instances/${instanceId}/files/${fileId}/links/${linkId}`;

    let request = {
      path,
      body: mapDashboardInstanceLinksUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceLinksUpdateOutput);
  }

  /**
   * @name Delete file link by ID
   * @description Deletes a specific file link by its ID.
   *
   * @param `instanceId` - string
   * @param `fileId` - string
   * @param `linkId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceLinksDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    fileId: string,
    linkId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceLinksDeleteOutput> {
    let path = `instances/${instanceId}/files/${fileId}/links/${linkId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardInstanceLinksDeleteOutput);
  }
}
