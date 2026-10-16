import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesAccessFilesBody,
  mapDashboardInstanceSandboxMachinesAccessFilesOutput,
  mapDashboardInstanceSandboxMachinesAccessPortsBody,
  mapDashboardInstanceSandboxMachinesAccessPortsOutput,
  mapDashboardInstanceSandboxMachinesAccessShellBody,
  mapDashboardInstanceSandboxMachinesAccessShellOutput,
  type DashboardInstanceSandboxMachinesAccessFilesBody,
  type DashboardInstanceSandboxMachinesAccessFilesOutput,
  type DashboardInstanceSandboxMachinesAccessPortsBody,
  type DashboardInstanceSandboxMachinesAccessPortsOutput,
  type DashboardInstanceSandboxMachinesAccessShellBody,
  type DashboardInstanceSandboxMachinesAccessShellOutput
} from '../resources';

/**
 * @name Sandbox machines controller
 * @description Create and operate sandbox machines. A machine boots from an image, can mount disks, and moves between running, paused, and hibernated states.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxMachinesAccessEndpoint {
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
   * @name Create shell access
   * @description Creates a short-lived token for an interactive shell in the machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `body` - DashboardInstanceSandboxMachinesAccessShellBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesAccessShellOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  shell(
    instanceId: string,
    machineId: string,
    body: DashboardInstanceSandboxMachinesAccessShellBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesAccessShellOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/access/shell`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxMachinesAccessShellBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesAccessShellOutput
    );
  }

  /**
   * @name Create files access
   * @description Creates a short-lived token for the machine's file service.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `body` - DashboardInstanceSandboxMachinesAccessFilesBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesAccessFilesOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  files(
    instanceId: string,
    machineId: string,
    body: DashboardInstanceSandboxMachinesAccessFilesBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesAccessFilesOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/access/files`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxMachinesAccessFilesBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesAccessFilesOutput
    );
  }

  /**
   * @name Create port access
   * @description Creates a short-lived token for reaching ports inside the machine.
   *
   * @param `instanceId` - string
   * @param `machineId` - string
   * @param `body` - DashboardInstanceSandboxMachinesAccessPortsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesAccessPortsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  ports(
    instanceId: string,
    machineId: string,
    body: DashboardInstanceSandboxMachinesAccessPortsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesAccessPortsOutput> {
    let path = `instances/${instanceId}/sandbox/machines/${machineId}/access/ports`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxMachinesAccessPortsBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxMachinesAccessPortsOutput
    );
  }
}
