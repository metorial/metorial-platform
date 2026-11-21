import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayProviderConnectionsCheckOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsCreateBody,
  mapDashboardInstanceAiGatewayProviderConnectionsCreateOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsDeleteOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsDisableOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsEnableOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsGetOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsListOutput,
  mapDashboardInstanceAiGatewayProviderConnectionsListQuery,
  mapDashboardInstanceAiGatewayProviderConnectionsUpdateBody,
  mapDashboardInstanceAiGatewayProviderConnectionsUpdateOutput,
  type DashboardInstanceAiGatewayProviderConnectionsCheckOutput,
  type DashboardInstanceAiGatewayProviderConnectionsCreateBody,
  type DashboardInstanceAiGatewayProviderConnectionsCreateOutput,
  type DashboardInstanceAiGatewayProviderConnectionsDeleteOutput,
  type DashboardInstanceAiGatewayProviderConnectionsDisableOutput,
  type DashboardInstanceAiGatewayProviderConnectionsEnableOutput,
  type DashboardInstanceAiGatewayProviderConnectionsGetOutput,
  type DashboardInstanceAiGatewayProviderConnectionsListOutput,
  type DashboardInstanceAiGatewayProviderConnectionsListQuery,
  type DashboardInstanceAiGatewayProviderConnectionsUpdateBody,
  type DashboardInstanceAiGatewayProviderConnectionsUpdateOutput
} from '../resources';

/**
 * @name AI gateway provider connections controller
 * @description Your own credentials for an upstream provider such as OpenAI or Anthropic. The gateway routes requests through them, so the provider bills you directly.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceAiGatewayProviderConnectionsEndpoint {
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
   * @name List AI gateway provider connections
   * @description Returns a paginated list of provider connections. Deleted connections are not included.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayProviderConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayProviderConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayProviderConnectionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsListOutput
    );
  }

  /**
   * @name Get AI gateway provider connection
   * @description Retrieves a provider connection by ID. The credentials are never returned.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsGetOutput
    );
  }

  /**
   * @name Create AI gateway provider connection
   * @description Connects a provider with your own credentials. The credentials are checked with the provider first, and the request fails if the provider rejects them.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayProviderConnectionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceAiGatewayProviderConnectionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsCreateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayProviderConnectionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsCreateOutput
    );
  }

  /**
   * @name Update AI gateway provider connection
   * @description Updates a provider connection. New credentials or config are checked with the provider first, and the request fails if the provider rejects them.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `body` - DashboardInstanceAiGatewayProviderConnectionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    connectionId: string,
    body: DashboardInstanceAiGatewayProviderConnectionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsUpdateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayProviderConnectionsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsUpdateOutput
    );
  }

  /**
   * @name Delete AI gateway provider connection
   * @description Deletes a provider connection. Requests are no longer routed through it and its credentials are discarded.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsDeleteOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsDeleteOutput
    );
  }

  /**
   * @name Check AI gateway provider connection
   * @description Checks the credentials with the provider now and updates the status. Disabled connections cannot be checked.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsCheckOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  check(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsCheckOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}/check`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsCheckOutput
    );
  }

  /**
   * @name Enable AI gateway provider connection
   * @description Turns a disabled connection back on and checks its credentials with the provider.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsEnableOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  enable(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsEnableOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}/enable`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsEnableOutput
    );
  }

  /**
   * @name Disable AI gateway provider connection
   * @description Turns a connection off without deleting it. Requests are not routed through it and its credentials are not checked until it is enabled again.
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProviderConnectionsDisableOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  disable(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProviderConnectionsDisableOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/provider-connections/${encodeURIComponent(connectionId)}/disable`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayProviderConnectionsDisableOutput
    );
  }
}
