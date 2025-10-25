import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerConfigVaultsCreateBody,
  mapDashboardInstanceServerConfigVaultsCreateOutput,
  mapDashboardInstanceServerConfigVaultsGetOutput,
  mapDashboardInstanceServerConfigVaultsListOutput,
  mapDashboardInstanceServerConfigVaultsListQuery,
  mapDashboardInstanceServerConfigVaultsUpdateBody,
  mapDashboardInstanceServerConfigVaultsUpdateOutput,
  type DashboardInstanceServerConfigVaultsCreateBody,
  type DashboardInstanceServerConfigVaultsCreateOutput,
  type DashboardInstanceServerConfigVaultsGetOutput,
  type DashboardInstanceServerConfigVaultsListOutput,
  type DashboardInstanceServerConfigVaultsListQuery,
  type DashboardInstanceServerConfigVaultsUpdateBody,
  type DashboardInstanceServerConfigVaultsUpdateOutput
} from '../resources';

/**
 * @name Server Config Vault controller
 * @description Store reusable configuration data for MCP servers in a secure vault.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServerConfigVaultsEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerConfigVaultsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerConfigVaultsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServerConfigVaultsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerConfigVaultsListOutput> {
    let path = `dashboard/instances/${instanceId}/server-config-vault`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServerConfigVaultsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerConfigVaultsListOutput
    );
  }

  /**
   * @name Get server run
   * @description Get the information of a specific server run
   *
   * @param `instanceId` - string
   * @param `serverConfigVaultId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerConfigVaultsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverConfigVaultId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerConfigVaultsGetOutput> {
    let path = `dashboard/instances/${instanceId}/server-config-vault/${serverConfigVaultId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerConfigVaultsGetOutput
    );
  }

  /**
   * @name Create server config vault
   * @description Create a new server config vault
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceServerConfigVaultsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerConfigVaultsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceServerConfigVaultsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerConfigVaultsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/server-config-vault`;

    let request = {
      path,
      body: mapDashboardInstanceServerConfigVaultsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceServerConfigVaultsCreateOutput
    );
  }

  /**
   * @name Update server config vault
   * @description Update an existing server config vault
   *
   * @param `instanceId` - string
   * @param `serverConfigVaultId` - string
   * @param `body` - DashboardInstanceServerConfigVaultsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerConfigVaultsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    serverConfigVaultId: string,
    body: DashboardInstanceServerConfigVaultsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerConfigVaultsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/server-config-vault/${serverConfigVaultId}`;

    let request = {
      path,
      body: mapDashboardInstanceServerConfigVaultsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceServerConfigVaultsUpdateOutput
    );
  }
}
