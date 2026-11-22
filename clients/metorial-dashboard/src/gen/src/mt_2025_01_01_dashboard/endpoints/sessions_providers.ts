import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsProvidersCreateBody,
  mapDashboardInstanceSessionsProvidersCreateOutput,
  mapDashboardInstanceSessionsProvidersDeleteOutput,
  mapDashboardInstanceSessionsProvidersGetOutput,
  mapDashboardInstanceSessionsProvidersListOutput,
  mapDashboardInstanceSessionsProvidersListQuery,
  mapDashboardInstanceSessionsProvidersUpdateBody,
  mapDashboardInstanceSessionsProvidersUpdateOutput,
  type DashboardInstanceSessionsProvidersCreateBody,
  type DashboardInstanceSessionsProvidersCreateOutput,
  type DashboardInstanceSessionsProvidersDeleteOutput,
  type DashboardInstanceSessionsProvidersGetOutput,
  type DashboardInstanceSessionsProvidersListOutput,
  type DashboardInstanceSessionsProvidersListQuery,
  type DashboardInstanceSessionsProvidersUpdateBody,
  type DashboardInstanceSessionsProvidersUpdateOutput
} from '../resources';

/**
 * @name Session Providers controller
 * @description A session provider is one provider connected to a session, with the deployment, config, and credentials it runs with.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsProvidersEndpoint {
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
   * @name List session providers
   * @description Returns a paginated list of session providers.
   *
   * @param `query` - DashboardInstanceSessionsProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSessionsProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersListOutput> {
    let path = 'session-providers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsProvidersListOutput
    );
  }

  /**
   * @name Get session provider
   * @description Retrieves a session provider.
   *
   * @param `sessionProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersGetOutput> {
    let path = `session-providers/${sessionProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsProvidersGetOutput
    );
  }

  /**
   * @name Create session provider
   * @description Creates a session provider. The session must be active.
   *
   * @param `body` - DashboardInstanceSessionsProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSessionsProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersCreateOutput> {
    let path = 'session-providers';

    let request = {
      path,
      body: mapDashboardInstanceSessionsProvidersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSessionsProvidersCreateOutput
    );
  }

  /**
   * @name Update session provider
   * @description Updates a session provider.
   *
   * @param `sessionProviderId` - string
   * @param `body` - DashboardInstanceSessionsProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    sessionProviderId: string,
    body: DashboardInstanceSessionsProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersUpdateOutput> {
    let path = `session-providers/${sessionProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionsProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSessionsProvidersUpdateOutput
    );
  }

  /**
   * @name Archive session provider
   * @description Archives a session provider. It stays listable with `status=archived`.
   *
   * @param `sessionProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    sessionProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersDeleteOutput> {
    let path = `session-providers/${sessionProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSessionsProvidersDeleteOutput
    );
  }
}
