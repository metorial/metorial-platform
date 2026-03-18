import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentitiesDelegationRequestsApproveOutput,
  mapDashboardInstanceIdentitiesDelegationRequestsApproveQuery,
  mapDashboardInstanceIdentitiesDelegationRequestsCreateBody,
  mapDashboardInstanceIdentitiesDelegationRequestsCreateOutput,
  mapDashboardInstanceIdentitiesDelegationRequestsDenyOutput,
  mapDashboardInstanceIdentitiesDelegationRequestsDenyQuery,
  mapDashboardInstanceIdentitiesDelegationRequestsGetOutput,
  mapDashboardInstanceIdentitiesDelegationRequestsGetQuery,
  mapDashboardInstanceIdentitiesDelegationRequestsListOutput,
  mapDashboardInstanceIdentitiesDelegationRequestsListQuery,
  type DashboardInstanceIdentitiesDelegationRequestsApproveOutput,
  type DashboardInstanceIdentitiesDelegationRequestsApproveQuery,
  type DashboardInstanceIdentitiesDelegationRequestsCreateBody,
  type DashboardInstanceIdentitiesDelegationRequestsCreateOutput,
  type DashboardInstanceIdentitiesDelegationRequestsDenyOutput,
  type DashboardInstanceIdentitiesDelegationRequestsDenyQuery,
  type DashboardInstanceIdentitiesDelegationRequestsGetOutput,
  type DashboardInstanceIdentitiesDelegationRequestsGetQuery,
  type DashboardInstanceIdentitiesDelegationRequestsListOutput,
  type DashboardInstanceIdentitiesDelegationRequestsListQuery
} from '../resources';

/**
 * @name Identity Delegation Requests controller
 * @description Identity delegation requests represent approval workflows for creating delegations that require consent.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIdentitiesDelegationRequestsEndpoint {
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
   * @name List identity delegation requests
   * @description Returns a paginated list of identity delegation requests.
   *
   * @param `query` - DashboardInstanceIdentitiesDelegationRequestsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationRequestsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIdentitiesDelegationRequestsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationRequestsListOutput> {
    let path = 'identity-delegation-requests';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationRequestsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationRequestsListOutput
    );
  }

  /**
   * @name Get identity delegation request
   * @description Retrieves a specific identity delegation request by ID.
   *
   * @param `identityDelegationRequestId` - string
   * @param `query` - DashboardInstanceIdentitiesDelegationRequestsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    identityDelegationRequestId: string,
    query?: DashboardInstanceIdentitiesDelegationRequestsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationRequestsGetOutput> {
    let path = `identity-delegation-requests/${identityDelegationRequestId}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationRequestsGetQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationRequestsGetOutput
    );
  }

  /**
   * @name Create identity delegation request
   * @description Creates a new identity delegation request.
   *
   * @param `body` - DashboardInstanceIdentitiesDelegationRequestsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationRequestsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIdentitiesDelegationRequestsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationRequestsCreateOutput> {
    let path = 'identity-delegation-requests';

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesDelegationRequestsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationRequestsCreateOutput
    );
  }

  /**
   * @name Approve identity delegation request
   * @description Approves an existing identity delegation request.
   *
   * @param `identityDelegationRequestId` - string
   * @param `query` - DashboardInstanceIdentitiesDelegationRequestsApproveQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationRequestsApproveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  approve(
    identityDelegationRequestId: string,
    query?: DashboardInstanceIdentitiesDelegationRequestsApproveQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationRequestsApproveOutput> {
    let path = `identity-delegation-requests/${identityDelegationRequestId}/approve`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationRequestsApproveQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationRequestsApproveOutput
    );
  }

  /**
   * @name Deny identity delegation request
   * @description Denies an existing identity delegation request.
   *
   * @param `identityDelegationRequestId` - string
   * @param `query` - DashboardInstanceIdentitiesDelegationRequestsDenyQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationRequestsDenyOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  deny(
    identityDelegationRequestId: string,
    query?: DashboardInstanceIdentitiesDelegationRequestsDenyQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationRequestsDenyOutput> {
    let path = `identity-delegation-requests/${identityDelegationRequestId}/deny`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationRequestsDenyQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationRequestsDenyOutput
    );
  }
}
