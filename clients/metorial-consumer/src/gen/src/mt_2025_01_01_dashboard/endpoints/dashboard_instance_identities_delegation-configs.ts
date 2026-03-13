import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentitiesDelegationConfigsCreateBody,
  mapDashboardInstanceIdentitiesDelegationConfigsCreateOutput,
  mapDashboardInstanceIdentitiesDelegationConfigsDeleteOutput,
  mapDashboardInstanceIdentitiesDelegationConfigsGetOutput,
  mapDashboardInstanceIdentitiesDelegationConfigsListOutput,
  mapDashboardInstanceIdentitiesDelegationConfigsListQuery,
  mapDashboardInstanceIdentitiesDelegationConfigsUpdateBody,
  mapDashboardInstanceIdentitiesDelegationConfigsUpdateOutput,
  type DashboardInstanceIdentitiesDelegationConfigsCreateBody,
  type DashboardInstanceIdentitiesDelegationConfigsCreateOutput,
  type DashboardInstanceIdentitiesDelegationConfigsDeleteOutput,
  type DashboardInstanceIdentitiesDelegationConfigsGetOutput,
  type DashboardInstanceIdentitiesDelegationConfigsListOutput,
  type DashboardInstanceIdentitiesDelegationConfigsListQuery,
  type DashboardInstanceIdentitiesDelegationConfigsUpdateBody,
  type DashboardInstanceIdentitiesDelegationConfigsUpdateOutput
} from '../resources';

/**
 * @name Identity Delegation Configs controller
 * @description Delegation configs define the default policy for sub-delegation behavior and delegation depth.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint {
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
   * @name List identity delegation configs
   * @description Returns a paginated list of identity delegation configs.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIdentitiesDelegationConfigsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationConfigsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIdentitiesDelegationConfigsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationConfigsListOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegation-configs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesDelegationConfigsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationConfigsListOutput
    );
  }

  /**
   * @name Get identity delegation config
   * @description Retrieves a specific identity delegation config by ID.
   *
   * @param `instanceId` - string
   * @param `identityDelegationConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationConfigsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    identityDelegationConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationConfigsGetOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegation-configs/${identityDelegationConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesDelegationConfigsGetOutput
    );
  }

  /**
   * @name Create identity delegation config
   * @description Creates a new identity delegation config.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIdentitiesDelegationConfigsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationConfigsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIdentitiesDelegationConfigsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationConfigsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegation-configs`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesDelegationConfigsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesDelegationConfigsCreateOutput
    );
  }

  /**
   * @name Update identity delegation config
   * @description Updates mutable fields on an existing identity delegation config.
   *
   * @param `instanceId` - string
   * @param `identityDelegationConfigId` - string
   * @param `body` - DashboardInstanceIdentitiesDelegationConfigsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationConfigsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    identityDelegationConfigId: string,
    body: DashboardInstanceIdentitiesDelegationConfigsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationConfigsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegation-configs/${identityDelegationConfigId}`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesDelegationConfigsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIdentitiesDelegationConfigsUpdateOutput
    );
  }

  /**
   * @name Delete identity delegation config
   * @description Archives an identity delegation config.
   *
   * @param `instanceId` - string
   * @param `identityDelegationConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDelegationConfigsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    identityDelegationConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDelegationConfigsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/identity-delegation-configs/${identityDelegationConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIdentitiesDelegationConfigsDeleteOutput
    );
  }
}
