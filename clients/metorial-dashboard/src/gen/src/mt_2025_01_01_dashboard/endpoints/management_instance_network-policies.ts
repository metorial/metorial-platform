import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceNetworkPoliciesCreateBody,
  mapDashboardInstanceNetworkPoliciesCreateOutput,
  mapDashboardInstanceNetworkPoliciesDeleteOutput,
  mapDashboardInstanceNetworkPoliciesGetOutput,
  mapDashboardInstanceNetworkPoliciesListOutput,
  mapDashboardInstanceNetworkPoliciesListQuery,
  mapDashboardInstanceNetworkPoliciesUpdateBody,
  mapDashboardInstanceNetworkPoliciesUpdateOutput,
  type DashboardInstanceNetworkPoliciesCreateBody,
  type DashboardInstanceNetworkPoliciesCreateOutput,
  type DashboardInstanceNetworkPoliciesDeleteOutput,
  type DashboardInstanceNetworkPoliciesGetOutput,
  type DashboardInstanceNetworkPoliciesListOutput,
  type DashboardInstanceNetworkPoliciesListQuery,
  type DashboardInstanceNetworkPoliciesUpdateBody,
  type DashboardInstanceNetworkPoliciesUpdateOutput
} from '../resources';

/**
 * @name Network Policies controller
 * @description A network policy is a reusable set of allow and deny rules. Firewalls attach policies to enforce them.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceNetworkPoliciesEndpoint {
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
   * @name List network policies
   * @description Returns a paginated list of network policies in the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceNetworkPoliciesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceNetworkPoliciesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/network-policies`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceNetworkPoliciesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceNetworkPoliciesListOutput
    );
  }

  /**
   * @name Get network policy
   * @description Retrieves a network policy.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    networkPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/network-policies/${encodeURIComponent(networkPolicyId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceNetworkPoliciesGetOutput
    );
  }

  /**
   * @name Create network policy
   * @description Creates a network policy.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceNetworkPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceNetworkPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesCreateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/network-policies`;

    let request = {
      path,
      body: mapDashboardInstanceNetworkPoliciesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceNetworkPoliciesCreateOutput
    );
  }

  /**
   * @name Update network policy
   * @description Updates a network policy. Omitted fields keep their current value.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `body` - DashboardInstanceNetworkPoliciesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    networkPolicyId: string,
    body: DashboardInstanceNetworkPoliciesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesUpdateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/network-policies/${encodeURIComponent(networkPolicyId)}`;

    let request = {
      path,
      body: mapDashboardInstanceNetworkPoliciesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceNetworkPoliciesUpdateOutput
    );
  }

  /**
   * @name Archive network policy
   * @description Archives a network policy. It stays listable with `status=archived`.
   *
   * @param `instanceId` - string
   * @param `networkPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    networkPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesDeleteOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/network-policies/${encodeURIComponent(networkPolicyId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceNetworkPoliciesDeleteOutput
    );
  }
}
