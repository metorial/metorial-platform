import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxSpecsGetOutput,
  mapDashboardInstanceSandboxSpecsListOutput,
  mapDashboardInstanceSandboxSpecsListQuery,
  type DashboardInstanceSandboxSpecsGetOutput,
  type DashboardInstanceSandboxSpecsListOutput,
  type DashboardInstanceSandboxSpecsListQuery
} from '../resources';

/**
 * @name Sandbox specs controller
 * @description The CPU and memory sizes sandbox machines can be created with.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxSpecsEndpoint {
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
   * @name List sandbox specs
   * @description Returns a paginated list of machine specs. The available field shows whether your plan allows creating machines of that size.
   *
   * @param `query` - DashboardInstanceSandboxSpecsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxSpecsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSandboxSpecsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxSpecsListOutput> {
    let path = 'sandbox/specs';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxSpecsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxSpecsListOutput
    );
  }

  /**
   * @name Get sandbox spec
   * @description Retrieves a machine spec by ID.
   *
   * @param `specId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxSpecsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    specId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxSpecsGetOutput> {
    let path = `sandbox/specs/${specId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxSpecsGetOutput
    );
  }
}
