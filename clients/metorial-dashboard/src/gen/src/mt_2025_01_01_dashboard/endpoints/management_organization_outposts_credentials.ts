import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOutpostsCredentialsCreateBody,
  mapDashboardOrganizationsOutpostsCredentialsCreateOutput,
  mapDashboardOrganizationsOutpostsCredentialsDeleteOutput,
  mapDashboardOrganizationsOutpostsCredentialsDisableOutput,
  mapDashboardOrganizationsOutpostsCredentialsGetOutput,
  mapDashboardOrganizationsOutpostsCredentialsListOutput,
  mapDashboardOrganizationsOutpostsCredentialsListQuery,
  type DashboardOrganizationsOutpostsCredentialsCreateBody,
  type DashboardOrganizationsOutpostsCredentialsCreateOutput,
  type DashboardOrganizationsOutpostsCredentialsDeleteOutput,
  type DashboardOrganizationsOutpostsCredentialsDisableOutput,
  type DashboardOrganizationsOutpostsCredentialsGetOutput,
  type DashboardOrganizationsOutpostsCredentialsListOutput,
  type DashboardOrganizationsOutpostsCredentialsListQuery
} from '../resources';

/**
 * @name Outpost controller
 * @description Read and write outposts, their access grants, and credentials
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOutpostsCredentialsEndpoint {
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
   * @name Create outpost credential
   * @description Create a new enrollment credential for an outpost owned by this organization
   *
   * @param `outpostId` - string
   * @param `body` - DashboardOrganizationsOutpostsCredentialsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCredentialsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    outpostId: string,
    body: DashboardOrganizationsOutpostsCredentialsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCredentialsCreateOutput> {
    let path = `organization/outposts/${outpostId}/credentials`;

    let request = {
      path,
      body: mapDashboardOrganizationsOutpostsCredentialsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsCredentialsCreateOutput
    );
  }

  /**
   * @name List outpost credentials
   * @description List the credentials for an outpost owned by this organization
   *
   * @param `outpostId` - string
   * @param `query` - DashboardOrganizationsOutpostsCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    outpostId: string,
    query?: DashboardOrganizationsOutpostsCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCredentialsListOutput> {
    let path = `organization/outposts/${outpostId}/credentials`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOutpostsCredentialsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOutpostsCredentialsListOutput
    );
  }

  /**
   * @name Get outpost credential
   * @description Get a credential for an outpost owned by this organization
   *
   * @param `outpostId` - string
   * @param `credentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    outpostId: string,
    credentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCredentialsGetOutput> {
    let path = `organization/outposts/${outpostId}/credentials/${credentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOutpostsCredentialsGetOutput
    );
  }

  /**
   * @name Disable outpost credential
   * @description Disable a credential for an outpost owned by this organization. A credential must be disabled before it can be deleted.
   *
   * @param `outpostId` - string
   * @param `credentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCredentialsDisableOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  disable(
    outpostId: string,
    credentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCredentialsDisableOutput> {
    let path = `organization/outposts/${outpostId}/credentials/${credentialId}/disable`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsCredentialsDisableOutput
    );
  }

  /**
   * @name Delete outpost credential
   * @description Delete a disabled credential for an outpost owned by this organization
   *
   * @param `outpostId` - string
   * @param `credentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCredentialsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    outpostId: string,
    credentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCredentialsDeleteOutput> {
    let path = `organization/outposts/${outpostId}/credentials/${credentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsOutpostsCredentialsDeleteOutput
    );
  }
}
