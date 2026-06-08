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
 * @description Manage reusable network policy definitions and their rules.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialNetworkPoliciesEndpoint {
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
   * @description Returns a paginated list of network policies.
   *
   * @param `query` - DashboardInstanceNetworkPoliciesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceNetworkPoliciesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesListOutput> {
    let path = 'network-policies';

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
   * @description Retrieves a specific network policy by ID.
   *
   * @param `networkPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    networkPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesGetOutput> {
    let path = `network-policies/${networkPolicyId}`;

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
   * @description Creates a new network policy.
   *
   * @param `body` - DashboardInstanceNetworkPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceNetworkPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesCreateOutput> {
    let path = 'network-policies';

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
   * @description Updates a network policy definition.
   *
   * @param `networkPolicyId` - string
   * @param `body` - DashboardInstanceNetworkPoliciesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    networkPolicyId: string,
    body: DashboardInstanceNetworkPoliciesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesUpdateOutput> {
    let path = `network-policies/${networkPolicyId}`;

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
   * @name Delete network policy
   * @description Archives a network policy.
   *
   * @param `networkPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceNetworkPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    networkPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceNetworkPoliciesDeleteOutput> {
    let path = `network-policies/${networkPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceNetworkPoliciesDeleteOutput
    );
  }
}
