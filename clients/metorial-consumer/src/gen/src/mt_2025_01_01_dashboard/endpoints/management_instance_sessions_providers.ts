import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

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
 * @description Session providers represent the providers that are actively connected to a session. Each session can have multiple providers, and providers can be added or removed during the session lifecycle.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsProvidersEndpoint {
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
   * @description Returns a paginated list of providers connected to a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersListOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsProvidersListOutput);
  }

  /**
   * @name Get session provider
   * @description Retrieves a specific provider connected to a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string,
    sessionProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersGetOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/providers/${sessionProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsProvidersGetOutput);
  }

  /**
   * @name Create session provider
   * @description Adds a new provider to an active session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `body` - DashboardInstanceSessionsProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    sessionId: string,
    body: DashboardInstanceSessionsProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersCreateOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/providers`;

    let request = {
      path,
      body: mapDashboardInstanceSessionsProvidersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceSessionsProvidersCreateOutput);
  }

  /**
   * @name Update session provider
   * @description Updates a provider connected to a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionProviderId` - string
   * @param `body` - DashboardInstanceSessionsProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    sessionId: string,
    sessionProviderId: string,
    body: DashboardInstanceSessionsProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersUpdateOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/providers/${sessionProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionsProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceSessionsProvidersUpdateOutput);
  }

  /**
   * @name Delete session provider
   * @description Removes a provider from a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    sessionId: string,
    sessionProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProvidersDeleteOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/providers/${sessionProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardInstanceSessionsProvidersDeleteOutput);
  }
}
