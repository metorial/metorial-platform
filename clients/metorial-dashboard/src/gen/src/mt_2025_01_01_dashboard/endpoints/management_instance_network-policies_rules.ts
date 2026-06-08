import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceNetworkPoliciesRulesCreateBody,
  mapDashboardInstanceNetworkPoliciesRulesCreateOutput,
  mapDashboardInstanceNetworkPoliciesRulesDeleteOutput,
  mapDashboardInstanceNetworkPoliciesRulesUpdateBody,
  mapDashboardInstanceNetworkPoliciesRulesUpdateOutput,
  type DashboardInstanceNetworkPoliciesRulesCreateBody,
  type DashboardInstanceNetworkPoliciesRulesCreateOutput,
  type DashboardInstanceNetworkPoliciesRulesDeleteOutput,
  type DashboardInstanceNetworkPoliciesRulesUpdateBody,
  type DashboardInstanceNetworkPoliciesRulesUpdateOutput
} from '../resources';

/**
 * @name Network Policies controller
 * @description Manage reusable network policy definitions and their rules.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceNetworkPoliciesRulesEndpoint {
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
   * @name Create network policy rule
   * @description Adds a rule to a network policy.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `body` - DashboardInstanceNetworkPoliciesRulesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesRulesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    networkPolicyId: string,
    body: DashboardInstanceNetworkPoliciesRulesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesRulesCreateOutput> {
    let path = `instances/${instanceId}/network-policies/${networkPolicyId}/rules`;

    let request = {
      path,
      body: mapDashboardInstanceNetworkPoliciesRulesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceNetworkPoliciesRulesCreateOutput
    );
  }

  /**
   * @name Update network policy rule
   * @description Updates a rule on a network policy.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `ruleId` - string
   * @param `body` - DashboardInstanceNetworkPoliciesRulesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesRulesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    networkPolicyId: string,
    ruleId: string,
    body: DashboardInstanceNetworkPoliciesRulesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesRulesUpdateOutput> {
    let path = `instances/${instanceId}/network-policies/${networkPolicyId}/rules/${ruleId}`;

    let request = {
      path,
      body: mapDashboardInstanceNetworkPoliciesRulesUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceNetworkPoliciesRulesUpdateOutput
    );
  }

  /**
   * @name Delete network policy rule
   * @description Removes a rule from a network policy.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `ruleId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesRulesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    networkPolicyId: string,
    ruleId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesRulesDeleteOutput> {
    let path = `instances/${instanceId}/network-policies/${networkPolicyId}/rules/${ruleId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceNetworkPoliciesRulesDeleteOutput
    );
  }
}
