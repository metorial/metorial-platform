import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFirewallsCreateBody,
  mapDashboardInstanceFirewallsCreateOutput,
  mapDashboardInstanceFirewallsDeleteOutput,
  mapDashboardInstanceFirewallsGetOutput,
  mapDashboardInstanceFirewallsListOutput,
  mapDashboardInstanceFirewallsListQuery,
  mapDashboardInstanceFirewallsUpdateBody,
  mapDashboardInstanceFirewallsUpdateOutput,
  type DashboardInstanceFirewallsCreateBody,
  type DashboardInstanceFirewallsCreateOutput,
  type DashboardInstanceFirewallsDeleteOutput,
  type DashboardInstanceFirewallsGetOutput,
  type DashboardInstanceFirewallsListOutput,
  type DashboardInstanceFirewallsListQuery,
  type DashboardInstanceFirewallsUpdateBody,
  type DashboardInstanceFirewallsUpdateOutput
} from '../resources';

/**
 * @name Firewalls controller
 * @description Manage firewalls and their attached network policies.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceFirewallsEndpoint {
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
   * @name List firewalls
   * @description Returns a paginated list of firewalls.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceFirewallsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceFirewallsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsListOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceFirewallsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFirewallsListOutput
    );
  }

  /**
   * @name Get firewall
   * @description Retrieves a specific firewall by ID.
   *
   * @param `instanceId` - string
   * @param `firewallId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    firewallId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsGetOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls/${firewallId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceFirewallsGetOutput);
  }

  /**
   * @name Create firewall
   * @description Creates a new firewall.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceFirewallsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceFirewallsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls`;

    let request = {
      path,
      body: mapDashboardInstanceFirewallsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceFirewallsCreateOutput
    );
  }

  /**
   * @name Update firewall
   * @description Updates a firewall definition.
   *
   * @param `instanceId` - string
   * @param `firewallId` - string
   * @param `body` - DashboardInstanceFirewallsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    firewallId: string,
    body: DashboardInstanceFirewallsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls/${firewallId}`;

    let request = {
      path,
      body: mapDashboardInstanceFirewallsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceFirewallsUpdateOutput
    );
  }

  /**
   * @name Delete firewall
   * @description Archives a firewall.
   *
   * @param `instanceId` - string
   * @param `firewallId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    firewallId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls/${firewallId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFirewallsDeleteOutput
    );
  }
}
