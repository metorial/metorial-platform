import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsSetupSessionsCreateBody,
  mapDashboardInstanceIntegrationsSetupSessionsCreateOutput,
  mapDashboardInstanceIntegrationsSetupSessionsGetOutput,
  mapDashboardInstanceIntegrationsSetupSessionsListOutput,
  mapDashboardInstanceIntegrationsSetupSessionsListQuery,
  type DashboardInstanceIntegrationsSetupSessionsCreateBody,
  type DashboardInstanceIntegrationsSetupSessionsCreateOutput,
  type DashboardInstanceIntegrationsSetupSessionsGetOutput,
  type DashboardInstanceIntegrationsSetupSessionsListOutput,
  type DashboardInstanceIntegrationsSetupSessionsListQuery
} from '../resources';

/**
 * @name Integration Setup Sessions controller
 * @description Integration setup sessions orchestrate configuring every provider required by an integration instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIntegrationsSetupSessionsEndpoint {
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
   * @name List integration setup sessions
   * @description Returns a paginated list of integration setup sessions.
   *
   * @param `query` - DashboardInstanceIntegrationsSetupSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsSetupSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIntegrationsSetupSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsSetupSessionsListOutput> {
    let path = 'integration-setup-sessions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsSetupSessionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsSetupSessionsListOutput
    );
  }

  /**
   * @name Get integration setup session
   * @description Retrieves a specific integration setup session.
   *
   * @param `integrationSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsSetupSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    integrationSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsSetupSessionsGetOutput> {
    let path = `integration-setup-sessions/${integrationSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsSetupSessionsGetOutput
    );
  }

  /**
   * @name Create integration setup session
   * @description Creates a new integration setup session and draft integration instance.
   *
   * @param `body` - DashboardInstanceIntegrationsSetupSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsSetupSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIntegrationsSetupSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsSetupSessionsCreateOutput> {
    let path = 'integration-setup-sessions';

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsSetupSessionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationsSetupSessionsCreateOutput
    );
  }
}
