import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFirewallBindingsCreateBody,
  mapDashboardInstanceFirewallBindingsCreateOutput,
  mapDashboardInstanceFirewallBindingsDeleteOutput,
  mapDashboardInstanceFirewallBindingsGetOutput,
  mapDashboardInstanceFirewallBindingsListOutput,
  mapDashboardInstanceFirewallBindingsListQuery,
  type DashboardInstanceFirewallBindingsCreateBody,
  type DashboardInstanceFirewallBindingsCreateOutput,
  type DashboardInstanceFirewallBindingsDeleteOutput,
  type DashboardInstanceFirewallBindingsGetOutput,
  type DashboardInstanceFirewallBindingsListOutput,
  type DashboardInstanceFirewallBindingsListQuery
} from '../resources';

/**
 * @name Firewall Bindings controller
 * @description Manage bindings that apply firewalls to enclaves, providers, or networks.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceFirewallBindingsEndpoint {
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
   * @name List firewall bindings
   * @description Returns a paginated list of firewall bindings.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceFirewallBindingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallBindingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceFirewallBindingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallBindingsListOutput> {
    let path = `dashboard/instances/${instanceId}/firewall-bindings`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceFirewallBindingsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFirewallBindingsListOutput
    );
  }

  /**
   * @name Get firewall binding
   * @description Retrieves a specific firewall binding by ID.
   *
   * @param `instanceId` - string
   * @param `firewallBindingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallBindingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    firewallBindingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallBindingsGetOutput> {
    let path = `dashboard/instances/${instanceId}/firewall-bindings/${firewallBindingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceFirewallBindingsGetOutput
    );
  }

  /**
   * @name Create firewall binding
   * @description Creates a binding that applies a firewall to a target.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceFirewallBindingsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallBindingsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceFirewallBindingsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallBindingsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/firewall-bindings`;

    let request = {
      path,
      body: mapDashboardInstanceFirewallBindingsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceFirewallBindingsCreateOutput
    );
  }

  /**
   * @name Delete firewall binding
   * @description Deletes a firewall binding.
   *
   * @param `instanceId` - string
   * @param `firewallBindingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallBindingsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    firewallBindingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallBindingsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/firewall-bindings/${firewallBindingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFirewallBindingsDeleteOutput
    );
  }
}
