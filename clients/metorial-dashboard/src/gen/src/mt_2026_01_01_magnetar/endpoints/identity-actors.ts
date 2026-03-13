import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentityActorsCreateBody,
  mapDashboardInstanceIdentityActorsCreateOutput,
  mapDashboardInstanceIdentityActorsDeleteOutput,
  mapDashboardInstanceIdentityActorsGetOutput,
  mapDashboardInstanceIdentityActorsListOutput,
  mapDashboardInstanceIdentityActorsListQuery,
  mapDashboardInstanceIdentityActorsUpdateBody,
  mapDashboardInstanceIdentityActorsUpdateOutput,
  type DashboardInstanceIdentityActorsCreateBody,
  type DashboardInstanceIdentityActorsCreateOutput,
  type DashboardInstanceIdentityActorsDeleteOutput,
  type DashboardInstanceIdentityActorsGetOutput,
  type DashboardInstanceIdentityActorsListOutput,
  type DashboardInstanceIdentityActorsListQuery,
  type DashboardInstanceIdentityActorsUpdateBody,
  type DashboardInstanceIdentityActorsUpdateOutput
} from '../resources';

/**
 * @name Identity Actors controller
 * @description Identity actors represent people or agents that can own identities and participate in delegations.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIdentityActorsEndpoint {
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
   * @name List identity actors
   * @description Returns a paginated list of identity actors for the instance.
   *
   * @param `query` - DashboardInstanceIdentityActorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentityActorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIdentityActorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentityActorsListOutput> {
    let path = 'identity-actors';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentityActorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentityActorsListOutput
    );
  }

  /**
   * @name Get identity actor
   * @description Retrieves a specific identity actor by ID.
   *
   * @param `identityActorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentityActorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    identityActorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentityActorsGetOutput> {
    let path = `identity-actors/${identityActorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentityActorsGetOutput
    );
  }

  /**
   * @name Create identity actor
   * @description Creates a new identity actor.
   *
   * @param `body` - DashboardInstanceIdentityActorsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentityActorsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIdentityActorsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentityActorsCreateOutput> {
    let path = 'identity-actors';

    let request = {
      path,
      body: mapDashboardInstanceIdentityActorsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentityActorsCreateOutput
    );
  }

  /**
   * @name Update identity actor
   * @description Updates mutable fields on an existing identity actor.
   *
   * @param `identityActorId` - string
   * @param `body` - DashboardInstanceIdentityActorsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentityActorsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    identityActorId: string,
    body: DashboardInstanceIdentityActorsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentityActorsUpdateOutput> {
    let path = `identity-actors/${identityActorId}`;

    let request = {
      path,
      body: mapDashboardInstanceIdentityActorsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIdentityActorsUpdateOutput
    );
  }

  /**
   * @name Delete identity actor
   * @description Archives an identity actor.
   *
   * @param `identityActorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentityActorsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    identityActorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentityActorsDeleteOutput> {
    let path = `identity-actors/${identityActorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIdentityActorsDeleteOutput
    );
  }
}
