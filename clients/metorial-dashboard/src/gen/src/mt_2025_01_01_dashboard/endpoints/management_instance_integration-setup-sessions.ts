import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationSetupSessionsCreateBody,
  mapDashboardInstanceIntegrationSetupSessionsCreateOutput,
  mapDashboardInstanceIntegrationSetupSessionsGetOutput,
  mapDashboardInstanceIntegrationSetupSessionsListOutput,
  mapDashboardInstanceIntegrationSetupSessionsListQuery,
  type DashboardInstanceIntegrationSetupSessionsCreateBody,
  type DashboardInstanceIntegrationSetupSessionsCreateOutput,
  type DashboardInstanceIntegrationSetupSessionsGetOutput,
  type DashboardInstanceIntegrationSetupSessionsListOutput,
  type DashboardInstanceIntegrationSetupSessionsListQuery
} from '../resources';

/**
 * @name Integration Setup Sessions controller
 * @description Integration setup sessions orchestrate configuring every provider required by an integration instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationSetupSessionsEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationSetupSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationSetupSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationSetupSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationSetupSessionsListOutput> {
    let path = `instances/${instanceId}/integration-setup-sessions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationSetupSessionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationSetupSessionsListOutput
    );
  }

  /**
   * @name Get integration setup session
   * @description Retrieves a specific integration setup session.
   *
   * @param `instanceId` - string
   * @param `integrationSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationSetupSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationSetupSessionsGetOutput> {
    let path = `instances/${instanceId}/integration-setup-sessions/${integrationSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationSetupSessionsGetOutput
    );
  }

  /**
   * @name Create integration setup session
   * @description Creates a new integration setup session and draft integration instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceIntegrationSetupSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationSetupSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceIntegrationSetupSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationSetupSessionsCreateOutput> {
    let path = `instances/${instanceId}/integration-setup-sessions`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationSetupSessionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIntegrationSetupSessionsCreateOutput
    );
  }
}
