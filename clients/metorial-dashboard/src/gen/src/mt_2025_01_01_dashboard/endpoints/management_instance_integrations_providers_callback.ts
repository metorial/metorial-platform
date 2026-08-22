import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsProvidersCallbackDeleteOutput,
  mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput,
  mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery,
  mapDashboardInstanceIntegrationsProvidersCallbackGetOutput,
  mapDashboardInstanceIntegrationsProvidersCallbackUpsertBody,
  mapDashboardInstanceIntegrationsProvidersCallbackUpsertOutput,
  type DashboardInstanceIntegrationsProvidersCallbackDeleteOutput,
  type DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput,
  type DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery,
  type DashboardInstanceIntegrationsProvidersCallbackGetOutput,
  type DashboardInstanceIntegrationsProvidersCallbackUpsertBody,
  type DashboardInstanceIntegrationsProvidersCallbackUpsertOutput
} from '../resources';

/**
 * @name Integration Provider Callback controller
 * @description Configure the callback owned by an integration provider.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationsProvidersCallbackEndpoint {
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
   * @name Get integration provider callback
   * @description Retrieves the active callback configured for an integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersCallbackGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersCallbackGetOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}/callback`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsProvidersCallbackGetOutput
    );
  }

  /**
   * @name Upsert integration provider callback
   * @description Creates or updates the callback owned by an integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `body` - DashboardInstanceIntegrationsProvidersCallbackUpsertBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersCallbackUpsertOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  upsert(
    instanceId: string,
    integrationProviderId: string,
    body: DashboardInstanceIntegrationsProvidersCallbackUpsertBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersCallbackUpsertOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}/callback`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsProvidersCallbackUpsertBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceIntegrationsProvidersCallbackUpsertOutput
    );
  }

  /**
   * @name Delete integration provider callback
   * @description Archives the callback owned by an integration provider.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersCallbackDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersCallbackDeleteOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}/callback`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsProvidersCallbackDeleteOutput
    );
  }

  /**
   * @name Get integration provider callback config schema
   * @description Returns the callback config schema for a proposed trigger selection.
   *
   * @param `instanceId` - string
   * @param `integrationProviderId` - string
   * @param `query` - DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getConfigSchema(
    instanceId: string,
    integrationProviderId: string,
    query?: DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput> {
    let path = `instances/${instanceId}/integration-providers/${integrationProviderId}/callback/config-schema`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaOutput
    );
  }
}
