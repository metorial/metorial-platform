import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentitiesCreateBody,
  mapDashboardInstanceIdentitiesCreateOutput,
  mapDashboardInstanceIdentitiesDeleteOutput,
  mapDashboardInstanceIdentitiesGetOutput,
  mapDashboardInstanceIdentitiesListOutput,
  mapDashboardInstanceIdentitiesListQuery,
  mapDashboardInstanceIdentitiesUpdateBody,
  mapDashboardInstanceIdentitiesUpdateOutput,
  type DashboardInstanceIdentitiesCreateBody,
  type DashboardInstanceIdentitiesCreateOutput,
  type DashboardInstanceIdentitiesDeleteOutput,
  type DashboardInstanceIdentitiesGetOutput,
  type DashboardInstanceIdentitiesListOutput,
  type DashboardInstanceIdentitiesListQuery,
  type DashboardInstanceIdentitiesUpdateBody,
  type DashboardInstanceIdentitiesUpdateOutput
} from '../resources';

/**
 * @name Identities controller
 * @description Identities bundle credentials under a single owner actor so provider access can be managed and delegated consistently.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIdentitiesEndpoint {
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
   * @name List identities
   * @description Returns a paginated list of identities for the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIdentitiesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIdentitiesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesListOutput> {
    let path = `dashboard/instances/${instanceId}/identities`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesListOutput
    );
  }

  /**
   * @name Get identity
   * @description Retrieves a specific identity by ID.
   *
   * @param `instanceId` - string
   * @param `identityId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    identityId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesGetOutput> {
    let path = `dashboard/instances/${instanceId}/identities/${identityId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesGetOutput
    );
  }

  /**
   * @name Create identity
   * @description Creates a new identity owned by an existing identity actor.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIdentitiesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIdentitiesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/identities`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesCreateOutput
    );
  }

  /**
   * @name Update identity
   * @description Updates mutable fields on an existing identity.
   *
   * @param `instanceId` - string
   * @param `identityId` - string
   * @param `body` - DashboardInstanceIdentitiesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    identityId: string,
    body: DashboardInstanceIdentitiesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/identities/${identityId}`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIdentitiesUpdateOutput
    );
  }

  /**
   * @name Delete identity
   * @description Archives an identity.
   *
   * @param `instanceId` - string
   * @param `identityId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    identityId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/identities/${identityId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIdentitiesDeleteOutput
    );
  }
}
