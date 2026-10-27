import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureResourceOwnershipGetOutput,
  mapDashboardProjectsConfigureResourceOwnershipUpdateBody,
  mapDashboardProjectsConfigureResourceOwnershipUpdateOutput,
  type DashboardProjectsConfigureResourceOwnershipGetOutput,
  type DashboardProjectsConfigureResourceOwnershipUpdateBody,
  type DashboardProjectsConfigureResourceOwnershipUpdateOutput
} from '../resources';

/**
 * @name Resource ownership configuration controller
 * @description Configure who can use resources owned by consumers in a project
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureResourceOwnershipEndpoint {
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
   * @name Get project resource ownership configuration
   * @description Get who can use consumer-owned resources in a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureResourceOwnershipGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureResourceOwnershipGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/resource-ownership`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureResourceOwnershipGetOutput
    );
  }

  /**
   * @name Update project resource ownership configuration
   * @description Update who can use consumer-owned resources in a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureResourceOwnershipUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureResourceOwnershipUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureResourceOwnershipUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureResourceOwnershipUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/resource-ownership`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureResourceOwnershipUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureResourceOwnershipUpdateOutput
    );
  }
}
