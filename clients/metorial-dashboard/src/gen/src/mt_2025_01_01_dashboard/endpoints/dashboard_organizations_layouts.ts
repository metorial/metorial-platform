import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsLayoutsGetOutput,
  mapDashboardOrganizationsLayoutsListOutput,
  mapDashboardOrganizationsLayoutsSetBody,
  mapDashboardOrganizationsLayoutsSetOutput,
  type DashboardOrganizationsLayoutsGetOutput,
  type DashboardOrganizationsLayoutsListOutput,
  type DashboardOrganizationsLayoutsSetBody,
  type DashboardOrganizationsLayoutsSetOutput
} from '../resources';

/**
 * @name Organization layouts controller
 * @description Manage custom user and organization layouts
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsLayoutsEndpoint {
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
   * @name List organization layouts
   * @description List materialized layouts for the current user and organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsLayoutsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsLayoutsListOutput> {
    let path = `dashboard/organizations/${organizationId}/layouts`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsLayoutsListOutput
    );
  }

  /**
   * @name Get organization layout
   * @description Get a layout by layout ID, layout type ID, or type identifier
   *
   * @param `organizationId` - string
   * @param `selector` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsLayoutsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    selector: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsLayoutsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/layouts/${selector}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsLayoutsGetOutput
    );
  }

  /**
   * @name Set organization layout
   * @description Set a layout by layout ID, layout type ID, or type identifier
   *
   * @param `organizationId` - string
   * @param `selector` - string
   * @param `body` - DashboardOrganizationsLayoutsSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsLayoutsSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    organizationId: string,
    selector: string,
    body: DashboardOrganizationsLayoutsSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsLayoutsSetOutput> {
    let path = `dashboard/organizations/${organizationId}/layouts/${selector}`;

    let request = {
      path,
      body: mapDashboardOrganizationsLayoutsSetBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardOrganizationsLayoutsSetOutput
    );
  }
}
