import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesOperationsGetOutput,
  mapDashboardInstanceSandboxMachinesOperationsListOutput,
  mapDashboardInstanceSandboxMachinesOperationsListQuery,
  type DashboardInstanceSandboxMachinesOperationsGetOutput,
  type DashboardInstanceSandboxMachinesOperationsListOutput,
  type DashboardInstanceSandboxMachinesOperationsListQuery
} from '../resources';

/**
 * @name Sandbox machine operations controller
 * @description Operations record each start, pause, hibernate, restart, terminate, update, or upgrade a machine went through.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxMachinesOperationsEndpoint {
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
   * @name List machine operations
   * @description Returns a paginated list of the operations of a machine.
   *
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesOperationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesOperationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    machineId: string,
    query?: DashboardInstanceSandboxMachinesOperationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesOperationsListOutput> {
    let path = `sandbox/machines/${machineId}/operations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesOperationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesOperationsListOutput
    );
  }

  /**
   * @name Get machine operation
   * @description Retrieves an operation of a machine.
   *
   * @param `machineId` - string
   * @param `operationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesOperationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    machineId: string,
    operationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesOperationsGetOutput> {
    let path = `sandbox/machines/${machineId}/operations/${operationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesOperationsGetOutput
    );
  }
}
