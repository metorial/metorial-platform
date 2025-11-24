import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersDeploymentsTemplatesCreateBody,
  mapDashboardInstanceServersDeploymentsTemplatesCreateOutput,
  mapDashboardInstanceServersDeploymentsTemplatesGetOutput,
  mapDashboardInstanceServersDeploymentsTemplatesListOutput,
  mapDashboardInstanceServersDeploymentsTemplatesListQuery,
  mapDashboardInstanceServersDeploymentsTemplatesUpdateBody,
  mapDashboardInstanceServersDeploymentsTemplatesUpdateOutput,
  type DashboardInstanceServersDeploymentsTemplatesCreateBody,
  type DashboardInstanceServersDeploymentsTemplatesCreateOutput,
  type DashboardInstanceServersDeploymentsTemplatesGetOutput,
  type DashboardInstanceServersDeploymentsTemplatesListOutput,
  type DashboardInstanceServersDeploymentsTemplatesListQuery,
  type DashboardInstanceServersDeploymentsTemplatesUpdateBody,
  type DashboardInstanceServersDeploymentsTemplatesUpdateOutput
} from '../resources';

/**
 * @name Server Deployment Template controller
 * @description Store reusable configuration data for MCP servers in a secure vault.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersDeploymentsTemplatesEndpoint {
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
   * @name List server runs
   * @description List all server runs
   *
   * @param `query` - DashboardInstanceServersDeploymentsTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceServersDeploymentsTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsTemplatesListOutput> {
    let path = 'server-deployment-template';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServersDeploymentsTemplatesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersDeploymentsTemplatesListOutput
    );
  }

  /**
   * @name Get server run
   * @description Get the information of a specific server run
   *
   * @param `serverDeploymentTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverDeploymentTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsTemplatesGetOutput> {
    let path = `server-deployment-template/${serverDeploymentTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersDeploymentsTemplatesGetOutput
    );
  }

  /**
   * @name Create server deployment template
   * @description Create a new server deployment template
   *
   * @param `body` - DashboardInstanceServersDeploymentsTemplatesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsTemplatesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceServersDeploymentsTemplatesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsTemplatesCreateOutput> {
    let path = 'server-deployment-template';

    let request = {
      path,
      body: mapDashboardInstanceServersDeploymentsTemplatesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceServersDeploymentsTemplatesCreateOutput
    );
  }

  /**
   * @name Update server deployment template
   * @description Update an existing server deployment template
   *
   * @param `serverDeploymentTemplateId` - string
   * @param `body` - DashboardInstanceServersDeploymentsTemplatesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersDeploymentsTemplatesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    serverDeploymentTemplateId: string,
    body: DashboardInstanceServersDeploymentsTemplatesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersDeploymentsTemplatesUpdateOutput> {
    let path = `server-deployment-template/${serverDeploymentTemplateId}`;

    let request = {
      path,
      body: mapDashboardInstanceServersDeploymentsTemplatesUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceServersDeploymentsTemplatesUpdateOutput
    );
  }
}
