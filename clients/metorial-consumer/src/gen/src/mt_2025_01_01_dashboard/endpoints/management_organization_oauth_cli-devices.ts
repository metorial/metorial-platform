import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthCliDevicesGetOutput,
  mapDashboardOrganizationsOauthCliDevicesListOutput,
  mapDashboardOrganizationsOauthCliDevicesListQuery,
  type DashboardOrganizationsOauthCliDevicesGetOutput,
  type DashboardOrganizationsOauthCliDevicesListOutput,
  type DashboardOrganizationsOauthCliDevicesListQuery
} from '../resources';

/**
 * @name CLI Device controller
 * @description Inspect CLI devices for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOauthCliDevicesEndpoint {
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
   * @name List organization CLI devices
   * @description Returns a paginated list of CLI devices for the organization.
   *
   * @param `query` - DashboardOrganizationsOauthCliDevicesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthCliDevicesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsOauthCliDevicesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthCliDevicesListOutput> {
    let path = 'organization/oauth/cli-devices';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOauthCliDevicesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthCliDevicesListOutput
    );
  }

  /**
   * @name Get organization CLI device
   * @description Retrieves a specific CLI device for the organization.
   *
   * @param `cliDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthCliDevicesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    cliDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthCliDevicesGetOutput> {
    let path = `organization/oauth/cli-devices/${cliDeviceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthCliDevicesGetOutput
    );
  }
}
