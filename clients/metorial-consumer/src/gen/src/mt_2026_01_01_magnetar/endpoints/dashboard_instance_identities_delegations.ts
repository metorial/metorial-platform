import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentitiesDelegationsCreateBody,
  mapDashboardInstanceIdentitiesDelegationsCreateOutput,
  mapDashboardInstanceIdentitiesDelegationsGetOutput,
  mapDashboardInstanceIdentitiesDelegationsListOutput,
  mapDashboardInstanceIdentitiesDelegationsListQuery,
  mapDashboardInstanceIdentitiesDelegationsRevokeOutput,
  type DashboardInstanceIdentitiesDelegationsCreateBody,
  type DashboardInstanceIdentitiesDelegationsCreateOutput,
  type DashboardInstanceIdentitiesDelegationsGetOutput,
  type DashboardInstanceIdentitiesDelegationsListOutput,
  type DashboardInstanceIdentitiesDelegationsListQuery,
  type DashboardInstanceIdentitiesDelegationsRevokeOutput
} from '../resources';

/**
 * @name Identity Delegations controller
 * @description Identity delegations grant provider permissions from one identity owner to another actor, with optional per-credential overrides.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIdentitiesDelegationsEndpoint {
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
   * @name List identity delegations
   * @description Returns a paginated list of identity delegations for the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIdentitiesDelegationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIdentitiesDelegationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationsListOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationsListOutput
    );
  }

  /**
   * @name Get identity delegation
   * @description Retrieves a specific identity delegation by ID.
   *
   * @param `instanceId` - string
   * @param `identityDelegationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    identityDelegationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationsGetOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegations/${identityDelegationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationsGetOutput
    );
  }

  /**
   * @name Create identity delegation
   * @description Creates a new identity delegation.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIdentitiesDelegationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIdentitiesDelegationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegations`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesDelegationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationsCreateOutput
    );
  }

  /**
   * @name Revoke identity delegation
   * @description Revokes an existing identity delegation.
   *
   * @param `instanceId` - string
   * @param `identityDelegationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationsRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    instanceId: string,
    identityDelegationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationsRevokeOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegations/${identityDelegationId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationsRevokeOutput
    );
  }
}
