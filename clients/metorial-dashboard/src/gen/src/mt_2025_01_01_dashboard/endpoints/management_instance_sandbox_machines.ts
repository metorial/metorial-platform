import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesCreateBody,
  mapDashboardInstanceSandboxMachinesCreateOutput,
  mapDashboardInstanceSandboxMachinesDeleteOutput,
  mapDashboardInstanceSandboxMachinesGetOutput,
  mapDashboardInstanceSandboxMachinesHibernateOutput,
  mapDashboardInstanceSandboxMachinesListOutput,
  mapDashboardInstanceSandboxMachinesListQuery,
  mapDashboardInstanceSandboxMachinesPauseOutput,
  mapDashboardInstanceSandboxMachinesRestartOutput,
  mapDashboardInstanceSandboxMachinesStartOutput,
  mapDashboardInstanceSandboxMachinesTouchOutput,
  mapDashboardInstanceSandboxMachinesUpdateBody,
  mapDashboardInstanceSandboxMachinesUpdateOutput,
  mapDashboardInstanceSandboxMachinesUsageOutput,
  mapDashboardInstanceSandboxMachinesUsageQuery,
  type DashboardInstanceSandboxMachinesCreateBody,
  type DashboardInstanceSandboxMachinesCreateOutput,
  type DashboardInstanceSandboxMachinesDeleteOutput,
  type DashboardInstanceSandboxMachinesGetOutput,
  type DashboardInstanceSandboxMachinesHibernateOutput,
  type DashboardInstanceSandboxMachinesListOutput,
  type DashboardInstanceSandboxMachinesListQuery,
  type DashboardInstanceSandboxMachinesPauseOutput,
  type DashboardInstanceSandboxMachinesRestartOutput,
  type DashboardInstanceSandboxMachinesStartOutput,
  type DashboardInstanceSandboxMachinesTouchOutput,
  type DashboardInstanceSandboxMachinesUpdateBody,
  type DashboardInstanceSandboxMachinesUpdateOutput,
  type DashboardInstanceSandboxMachinesUsageOutput,
  type DashboardInstanceSandboxMachinesUsageQuery
} from '../resources';

/**
 * @name Sandbox machines controller
 * @description Create and operate sandbox machines. A machine boots from an image, can mount disks, and moves between running, paused, and hibernated states.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxMachinesEndpoint {
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
   * @name List sandbox machines
   * @description Returns a paginated list of machines.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSandboxMachinesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSandboxMachinesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesListOutput> {
    let path = `instances/${instanceId}/sandbox/machines`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesListOutput
    );
  }

  /**
   * @name Get sandbox machine
   * @description Retrieves a machine by ID.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesGetOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesGetOutput
    );
  }

  /**
   * @name Create sandbox machine
   * @description Creates a machine and, unless disabled, starts it.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSandboxMachinesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSandboxMachinesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesCreateOutput> {
    let path = `instances/${instanceId}/sandbox/machines`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxMachinesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesCreateOutput
    );
  }

  /**
   * @name Update sandbox machine
   * @description Updates a machine. Changes to its size, runtime, or mounts take effect once the machine restarts, which happens on its own for a running machine, and the machine reports restart_required until then.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `body` - DashboardInstanceSandboxMachinesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    machineId: string,
    body: DashboardInstanceSandboxMachinesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesUpdateOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxMachinesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSandboxMachinesUpdateOutput
    );
  }

  /**
   * @name Terminate sandbox machine
   * @description Terminates a machine and deletes its root disk.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesDeleteOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSandboxMachinesDeleteOutput
    );
  }

  /**
   * @name Start sandbox machine
   * @description Starts a paused or hibernated machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesStartOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  start(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesStartOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/start`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesStartOutput
    );
  }

  /**
   * @name Pause sandbox machine
   * @description Pauses a running machine and keeps its memory state.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesPauseOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  pause(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesPauseOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/pause`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesPauseOutput
    );
  }

  /**
   * @name Hibernate sandbox machine
   * @description Hibernates a machine so it stops consuming compute resources.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesHibernateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  hibernate(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesHibernateOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/hibernate`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesHibernateOutput
    );
  }

  /**
   * @name Restart sandbox machine
   * @description Restarts a machine on a fresh instance.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesRestartOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  restart(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesRestartOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/restart`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesRestartOutput
    );
  }

  /**
   * @name Touch sandbox machine
   * @description Records activity so the machine is not paused for being idle.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesTouchOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  touch(
    instanceId: string,
    machineId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesTouchOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/touch`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesTouchOutput
    );
  }

  /**
   * @name List sandbox machine usage
   * @description Returns resource usage samples of a machine, newest first.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesUsageQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesUsageOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  usage(
    instanceId: string,
    machineId: string,
    query?: DashboardInstanceSandboxMachinesUsageQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesUsageOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/usage`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesUsageQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesUsageOutput
    );
  }
}
