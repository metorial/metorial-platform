import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersDeploymentsCreateBody,
  mapDashboardInstanceServersDeploymentsCreateOutput,
  mapDashboardInstanceServersDeploymentsDeleteOutput,
  mapDashboardInstanceServersDeploymentsGetOutput,
  mapDashboardInstanceServersDeploymentsListOutput,
  mapDashboardInstanceServersDeploymentsListQuery,
  mapDashboardInstanceServersDeploymentsUpdateBody,
  mapDashboardInstanceServersDeploymentsUpdateOutput,
  type DashboardInstanceServersDeploymentsCreateBody,
  type DashboardInstanceServersDeploymentsCreateOutput,
  type DashboardInstanceServersDeploymentsDeleteOutput,
  type DashboardInstanceServersDeploymentsGetOutput,
  type DashboardInstanceServersDeploymentsListOutput,
  type DashboardInstanceServersDeploymentsListQuery,
  type DashboardInstanceServersDeploymentsUpdateBody,
  type DashboardInstanceServersDeploymentsUpdateOutput
} from '../resources';

/**
 * @name Server Deployment controller
 * @description A server deployment represents a specific instance of an MCP server that can be connected to. It contains configuration for the MCP server, such as API keys for the underlying MCP server.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersDeploymentsEndpoint {
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
   * @name List server deployments
   * @description Retrieve a list of server deployments within the instance. Supports filtering by status, server, variant, and session.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersDeploymentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersDeploymentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsListOutput> {
    let path = `instances/${instanceId}/server-deployments`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServersDeploymentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersDeploymentsListOutput
    );
  }

  /**
   * @name Get server deployment
   * @description Fetch detailed information about a specific server deployment.
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsGetOutput> {
    let path = `instances/${instanceId}/server-deployments/${serverDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersDeploymentsGetOutput
    );
  }

  /**
   * @name Create server deployment
   * @description Create a new server deployment using an existing or newly defined server implementation.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceServersDeploymentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceServersDeploymentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsCreateOutput> {
    let path = `instances/${instanceId}/server-deployments`;

    let request = {
      path,
      body: mapDashboardInstanceServersDeploymentsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceServersDeploymentsCreateOutput
    );
  }

  /**
   * @name Update server deployment
   * @description Update metadata, configuration, or other properties of a server deployment.
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   * @param `body` - DashboardInstanceServersDeploymentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    serverDeploymentId: string,
    body: DashboardInstanceServersDeploymentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsUpdateOutput> {
    let path = `instances/${instanceId}/server-deployments/${serverDeploymentId}`;

    let request = {
      path,
      body: mapDashboardInstanceServersDeploymentsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceServersDeploymentsUpdateOutput
    );
  }

  /**
   * @name Delete server deployment
   * @description Delete a server deployment from the instance.
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    serverDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsDeleteOutput> {
    let path = `instances/${instanceId}/server-deployments/${serverDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceServersDeploymentsDeleteOutput
    );
  }
}
