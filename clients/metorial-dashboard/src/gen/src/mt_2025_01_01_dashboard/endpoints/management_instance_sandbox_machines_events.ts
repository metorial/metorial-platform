import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesEventsGetOutput,
  mapDashboardInstanceSandboxMachinesEventsListOutput,
  mapDashboardInstanceSandboxMachinesEventsListQuery,
  type DashboardInstanceSandboxMachinesEventsGetOutput,
  type DashboardInstanceSandboxMachinesEventsListOutput,
  type DashboardInstanceSandboxMachinesEventsListQuery
} from '../resources';

/**
 * @name Sandbox machine events controller
 * @description The timeline of everything that happened to a machine and its instances.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxMachinesEventsEndpoint {
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
   * @name List machine events
   * @description Returns a paginated list of the events of a machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    machineId: string,
    query?: DashboardInstanceSandboxMachinesEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesEventsListOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesEventsListOutput
    );
  }

  /**
   * @name Get machine event
   * @description Retrieves an event of a machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `eventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    machineId: string,
    eventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesEventsGetOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/events/${eventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesEventsGetOutput
    );
  }
}
