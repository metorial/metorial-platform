import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceFirewallsNetworkPoliciesAttachBody,
  mapDashboardInstanceFirewallsNetworkPoliciesAttachOutput,
  mapDashboardInstanceFirewallsNetworkPoliciesDetachOutput,
  type DashboardInstanceFirewallsNetworkPoliciesAttachBody,
  type DashboardInstanceFirewallsNetworkPoliciesAttachOutput,
  type DashboardInstanceFirewallsNetworkPoliciesDetachOutput
} from '../resources';

/**
 * @name Firewalls controller
 * @description Manage firewalls and their attached network policies.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceFirewallsNetworkPoliciesEndpoint {
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
   * @name Attach network policy
   * @description Attaches a network policy to a firewall.
   *
   * @param `instanceId` - string
   * @param `firewallId` - string
   * @param `body` - DashboardInstanceFirewallsNetworkPoliciesAttachBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsNetworkPoliciesAttachOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  attach(
    instanceId: string,
    firewallId: string,
    body: DashboardInstanceFirewallsNetworkPoliciesAttachBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsNetworkPoliciesAttachOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls/${firewallId}/network-policies`;

    let request = {
      path,
      body: mapDashboardInstanceFirewallsNetworkPoliciesAttachBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceFirewallsNetworkPoliciesAttachOutput
    );
  }

  /**
   * @name Detach network policy
   * @description Detaches a network policy from a firewall.
   *
   * @param `instanceId` - string
   * @param `firewallId` - string
   * @param `networkPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceFirewallsNetworkPoliciesDetachOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  detach(
    instanceId: string,
    firewallId: string,
    networkPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceFirewallsNetworkPoliciesDetachOutput> {
    let path = `dashboard/instances/${instanceId}/firewalls/${firewallId}/network-policies/${networkPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceFirewallsNetworkPoliciesDetachOutput
    );
  }
}
