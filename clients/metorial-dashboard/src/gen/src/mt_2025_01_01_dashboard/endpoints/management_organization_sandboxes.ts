import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsSandboxesCreateBody,
  mapDashboardOrganizationsSandboxesCreateOutput,
  mapDashboardOrganizationsSandboxesGetOutput,
  mapDashboardOrganizationsSandboxesListOutput,
  mapDashboardOrganizationsSandboxesListQuery,
  mapDashboardOrganizationsSandboxesUpdateBody,
  mapDashboardOrganizationsSandboxesUpdateOutput,
  type DashboardOrganizationsSandboxesCreateBody,
  type DashboardOrganizationsSandboxesCreateOutput,
  type DashboardOrganizationsSandboxesGetOutput,
  type DashboardOrganizationsSandboxesListOutput,
  type DashboardOrganizationsSandboxesListQuery,
  type DashboardOrganizationsSandboxesUpdateBody,
  type DashboardOrganizationsSandboxesUpdateOutput
} from '../resources';

/**
 * @name Sandbox controller
 * @description Read and write development sandbox information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationSandboxesEndpoint {
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
   * @name List organization sandboxes
   * @description List all organization sandboxes
   *
   * @param `query` - DashboardOrganizationsSandboxesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsSandboxesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsSandboxesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsSandboxesListOutput> {
    let path = 'organization/sandboxes';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsSandboxesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsSandboxesListOutput
    );
  }

  /**
   * @name Get organization sandbox
   * @description Get the information of a specific organization sandbox
   *
   * @param `sandboxId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsSandboxesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sandboxId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsSandboxesGetOutput> {
    let path = `organization/sandboxes/${sandboxId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsSandboxesGetOutput
    );
  }

  /**
   * @name Create organization sandbox
   * @description Create a new development sandbox
   *
   * @param `body` - DashboardOrganizationsSandboxesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsSandboxesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsSandboxesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsSandboxesCreateOutput> {
    let path = 'organization/sandboxes';

    let request = {
      path,
      body: mapDashboardOrganizationsSandboxesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsSandboxesCreateOutput
    );
  }

  /**
   * @name Update organization sandbox
   * @description Update a development sandbox
   *
   * @param `sandboxId` - string
   * @param `body` - DashboardOrganizationsSandboxesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsSandboxesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    sandboxId: string,
    body: DashboardOrganizationsSandboxesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsSandboxesUpdateOutput> {
    let path = `organization/sandboxes/${sandboxId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsSandboxesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsSandboxesUpdateOutput
    );
  }
}
