import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsProjectsBrandingGetOutput,
  mapDashboardOrganizationsProjectsBrandingUpdateBody,
  mapDashboardOrganizationsProjectsBrandingUpdateOutput,
  type DashboardOrganizationsProjectsBrandingGetOutput,
  type DashboardOrganizationsProjectsBrandingUpdateBody,
  type DashboardOrganizationsProjectsBrandingUpdateOutput
} from '../resources';

/**
 * @name Project controller
 * @description Read and write project information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsProjectsBrandingEndpoint {
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
   * @name Get project branding
   * @description Get branding information for a specific project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsBrandingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsBrandingGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/branding`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsProjectsBrandingGetOutput
    );
  }

  /**
   * @name Update project branding
   * @description Update branding information for a specific project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardOrganizationsProjectsBrandingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsBrandingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardOrganizationsProjectsBrandingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsBrandingUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/branding`;

    let request = {
      path,
      body: mapDashboardOrganizationsProjectsBrandingUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsProjectsBrandingUpdateOutput
    );
  }
}
