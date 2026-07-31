import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsConfigsGetOutput,
  mapDashboardOrganizationsConfigsListOutput,
  mapDashboardOrganizationsConfigsSetBody,
  mapDashboardOrganizationsConfigsSetOutput,
  type DashboardOrganizationsConfigsGetOutput,
  type DashboardOrganizationsConfigsListOutput,
  type DashboardOrganizationsConfigsSetBody,
  type DashboardOrganizationsConfigsSetOutput
} from '../resources';

/**
 * @name Organization configs controller
 * @description Manage custom user and organization configuration
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsConfigsEndpoint {
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
   * @name List organization configs
   * @description List materialized configs for the current user and organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigsListOutput> {
    let path = `dashboard/organizations/${organizationId}/configs`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConfigsListOutput
    );
  }

  /**
   * @name Get organization config
   * @description Get a config by config ID, config type ID, or type identifier
   *
   * @param `organizationId` - string
   * @param `selector` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    selector: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/configs/${selector}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConfigsGetOutput
    );
  }

  /**
   * @name Set organization config
   * @description Set a config by config ID, config type ID, or type identifier
   *
   * @param `organizationId` - string
   * @param `selector` - string
   * @param `body` - DashboardOrganizationsConfigsSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigsSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    organizationId: string,
    selector: string,
    body: DashboardOrganizationsConfigsSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigsSetOutput> {
    let path = `dashboard/organizations/${organizationId}/configs/${selector}`;

    let request = {
      path,
      body: mapDashboardOrganizationsConfigsSetBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardOrganizationsConfigsSetOutput
    );
  }
}
