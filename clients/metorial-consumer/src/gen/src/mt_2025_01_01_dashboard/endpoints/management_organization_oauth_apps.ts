import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthAppsCreateBody,
  mapDashboardOrganizationsOauthAppsCreateOutput,
  mapDashboardOrganizationsOauthAppsDeleteOutput,
  mapDashboardOrganizationsOauthAppsGetOutput,
  mapDashboardOrganizationsOauthAppsListOutput,
  mapDashboardOrganizationsOauthAppsListQuery,
  mapDashboardOrganizationsOauthAppsUpdateBody,
  mapDashboardOrganizationsOauthAppsUpdateOutput,
  type DashboardOrganizationsOauthAppsCreateBody,
  type DashboardOrganizationsOauthAppsCreateOutput,
  type DashboardOrganizationsOauthAppsDeleteOutput,
  type DashboardOrganizationsOauthAppsGetOutput,
  type DashboardOrganizationsOauthAppsListOutput,
  type DashboardOrganizationsOauthAppsListQuery,
  type DashboardOrganizationsOauthAppsUpdateBody,
  type DashboardOrganizationsOauthAppsUpdateOutput
} from '../resources';

/**
 * @name OAuth Application controller
 * @description Create and manage OAuth applications for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOauthAppsEndpoint {
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
   * @name List organization OAuth applications
   * @description Returns a paginated list of OAuth applications owned by the organization.
   *
   * @param `query` - DashboardOrganizationsOauthAppsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsOauthAppsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsListOutput> {
    let path = 'organization/oauth/apps';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOauthAppsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthAppsListOutput
    );
  }

  /**
   * @name Get organization OAuth application
   * @description Retrieves a specific OAuth application owned by the organization.
   *
   * @param `oauthApplicationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    oauthApplicationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsGetOutput> {
    let path = `organization/oauth/apps/${oauthApplicationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthAppsGetOutput
    );
  }

  /**
   * @name Create organization OAuth application
   * @description Creates a new OAuth application that belongs to the organization.
   *
   * @param `body` - DashboardOrganizationsOauthAppsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsOauthAppsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsCreateOutput> {
    let path = 'organization/oauth/apps';

    let request = {
      path,
      body: mapDashboardOrganizationsOauthAppsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOauthAppsCreateOutput
    );
  }

  /**
   * @name Update organization OAuth application
   * @description Updates an existing OAuth application owned by the organization.
   *
   * @param `oauthApplicationId` - string
   * @param `body` - DashboardOrganizationsOauthAppsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    oauthApplicationId: string,
    body: DashboardOrganizationsOauthAppsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsUpdateOutput> {
    let path = `organization/oauth/apps/${oauthApplicationId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsOauthAppsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsOauthAppsUpdateOutput
    );
  }

  /**
   * @name Delete organization OAuth application
   * @description Archives an OAuth application owned by the organization.
   *
   * @param `oauthApplicationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    oauthApplicationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsDeleteOutput> {
    let path = `organization/oauth/apps/${oauthApplicationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsOauthAppsDeleteOutput
    );
  }
}
