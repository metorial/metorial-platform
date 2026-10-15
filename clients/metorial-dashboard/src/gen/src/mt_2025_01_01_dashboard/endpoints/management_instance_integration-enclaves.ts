import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationEnclavesGetOutput,
  mapDashboardInstanceIntegrationEnclavesListOutput,
  mapDashboardInstanceIntegrationEnclavesListQuery,
  type DashboardInstanceIntegrationEnclavesGetOutput,
  type DashboardInstanceIntegrationEnclavesListOutput,
  type DashboardInstanceIntegrationEnclavesListQuery
} from '../resources';

/**
 * @name Integration Enclaves controller
 * @description Read integration enclave records for provider deployments in an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationEnclavesEndpoint {
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
   * @name List integration enclaves
   * @description Returns a paginated list of integration enclaves.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationEnclavesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationEnclavesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationEnclavesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationEnclavesListOutput> {
    let path = `instances/${instanceId}/integration-enclaves`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationEnclavesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationEnclavesListOutput
    );
  }

  /**
   * @name Get integration enclave
   * @description Retrieves a specific integration enclave by ID.
   *
   * @param `instanceId` - string
   * @param `integrationEnclaveId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationEnclavesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationEnclaveId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationEnclavesGetOutput> {
    let path = `instances/${instanceId}/integration-enclaves/${integrationEnclaveId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationEnclavesGetOutput
    );
  }
}
