import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceEnclavesGetOutput,
  mapDashboardInstanceEnclavesListOutput,
  mapDashboardInstanceEnclavesListQuery,
  type DashboardInstanceEnclavesGetOutput,
  type DashboardInstanceEnclavesListOutput,
  type DashboardInstanceEnclavesListQuery
} from '../resources';

/**
 * @name Enclaves controller
 * @description Read enclave records for provider deployments in an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceEnclavesEndpoint {
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
   * @name List enclaves
   * @description Returns a paginated list of enclaves.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceEnclavesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceEnclavesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceEnclavesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceEnclavesListOutput> {
    let path = `instances/${instanceId}/enclaves`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceEnclavesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceEnclavesListOutput);
  }

  /**
   * @name Get enclave
   * @description Retrieves a specific enclave by ID.
   *
   * @param `instanceId` - string
   * @param `enclaveId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceEnclavesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    enclaveId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceEnclavesGetOutput> {
    let path = `instances/${instanceId}/enclaves/${enclaveId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceEnclavesGetOutput);
  }
}
