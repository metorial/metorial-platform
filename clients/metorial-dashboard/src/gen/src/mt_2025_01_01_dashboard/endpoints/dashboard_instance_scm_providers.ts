import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceScmProvidersCreateBody,
  mapDashboardInstanceScmProvidersCreateOutput,
  mapDashboardInstanceScmProvidersGetOutput,
  mapDashboardInstanceScmProvidersListOutput,
  mapDashboardInstanceScmProvidersListQuery,
  type DashboardInstanceScmProvidersCreateBody,
  type DashboardInstanceScmProvidersCreateOutput,
  type DashboardInstanceScmProvidersGetOutput,
  type DashboardInstanceScmProvidersListOutput,
  type DashboardInstanceScmProvidersListQuery
} from '../resources';

/**
 * @name SCM Providers controller
 * @description Manage SCM providers configured for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceScmProvidersEndpoint {
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
   * @name List SCM providers
   * @description Returns a paginated list of SCM providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceScmProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceScmProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmProvidersListOutput> {
    let path = `dashboard/instances/${instanceId}/scm/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceScmProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceScmProvidersListOutput
    );
  }

  /**
   * @name Get SCM provider
   * @description Retrieves a specific SCM provider by ID.
   *
   * @param `instanceId` - string
   * @param `scmProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    scmProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmProvidersGetOutput> {
    let path = `dashboard/instances/${instanceId}/scm/providers/${scmProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceScmProvidersGetOutput
    );
  }

  /**
   * @name Create SCM provider
   * @description Initiates a setup session for a self-hosted SCM provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceScmProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceScmProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmProvidersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/scm/providers`;

    let request = {
      path,
      body: mapDashboardInstanceScmProvidersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmProvidersCreateOutput
    );
  }
}
