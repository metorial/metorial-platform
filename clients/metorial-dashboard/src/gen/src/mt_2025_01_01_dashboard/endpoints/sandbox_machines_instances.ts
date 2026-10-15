import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesInstancesGetOutput,
  mapDashboardInstanceSandboxMachinesInstancesListOutput,
  mapDashboardInstanceSandboxMachinesInstancesListQuery,
  mapDashboardInstanceSandboxMachinesInstancesLogsOutput,
  mapDashboardInstanceSandboxMachinesInstancesLogsQuery,
  type DashboardInstanceSandboxMachinesInstancesGetOutput,
  type DashboardInstanceSandboxMachinesInstancesListOutput,
  type DashboardInstanceSandboxMachinesInstancesListQuery,
  type DashboardInstanceSandboxMachinesInstancesLogsOutput,
  type DashboardInstanceSandboxMachinesInstancesLogsQuery
} from '../resources';

/**
 * @name Sandbox machine instances controller
 * @description Instances are the concrete virtual machines a sandbox machine runs on over its lifetime.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxMachinesInstancesEndpoint {
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
   * @name List machine instances
   * @description Returns a paginated list of the instances of a machine.
   *
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    machineId: string,
    query?: DashboardInstanceSandboxMachinesInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesInstancesListOutput> {
    let path = `sandbox/machines/${machineId}/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesInstancesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesInstancesListOutput
    );
  }

  /**
   * @name Get machine instance
   * @description Retrieves an instance of a machine.
   *
   * @param `machineId` - string
   * @param `machineInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    machineId: string,
    machineInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesInstancesGetOutput> {
    let path = `sandbox/machines/${machineId}/instances/${machineInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesInstancesGetOutput
    );
  }

  /**
   * @name Get machine instance logs
   * @description Returns a page of the console output of an instance.
   *
   * @param `machineId` - string
   * @param `machineInstanceId` - string
   * @param `query` - DashboardInstanceSandboxMachinesInstancesLogsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesInstancesLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  logs(
    machineId: string,
    machineInstanceId: string,
    query?: DashboardInstanceSandboxMachinesInstancesLogsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesInstancesLogsOutput> {
    let path = `sandbox/machines/${machineId}/instances/${machineInstanceId}/logs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesInstancesLogsQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesInstancesLogsOutput
    );
  }
}
