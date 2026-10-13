import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesErrorsGetOutput,
  mapDashboardInstanceSandboxMachinesErrorsListOutput,
  mapDashboardInstanceSandboxMachinesErrorsListQuery,
  type DashboardInstanceSandboxMachinesErrorsGetOutput,
  type DashboardInstanceSandboxMachinesErrorsListOutput,
  type DashboardInstanceSandboxMachinesErrorsListQuery
} from '../resources';

/**
 * @name Sandbox machine errors controller
 * @description Errors reported from inside a machine, such as a failing lifecycle hook or setup command.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxMachinesErrorsEndpoint {
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
   * @name List machine errors
   * @description Returns a paginated list of the errors reported by a machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    machineId: string,
    query?: DashboardInstanceSandboxMachinesErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesErrorsListOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/errors`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesErrorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesErrorsListOutput
    );
  }

  /**
   * @name Get machine error
   * @description Retrieves an error reported by a machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `errorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesErrorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    machineId: string,
    errorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesErrorsGetOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/errors/${errorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesErrorsGetOutput
    );
  }
}
