import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsCreateBody,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsCreateOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsListOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsImportsListQuery,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateBody,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsGetOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsListOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsImportsListQuery
} from '../resources';

/**
 * @name Provider Auth Imports controller
 * @description An auth import lets you bring in existing OAuth tokens or credentials from another system, so users don't need to re-authenticate to use Metorial.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderDeploymentsAuthConfigsImportsEndpoint {
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
   * @name List provider auth imports
   * @description Returns a paginated list of provider auth imports.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsAuthConfigsImportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsImportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsAuthConfigsImportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-imports`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsAuthConfigsImportsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsImportsListOutput
    );
  }

  /**
   * @name Get provider auth import
   * @description Retrieves a specific provider auth import by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthImportId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsImportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthImportId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-imports/${providerAuthImportId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetOutput
    );
  }

  /**
   * @name Create provider auth import
   * @description Imports authentication credentials for a provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-imports`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthConfigsImportsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsImportsCreateOutput
    );
  }

  /**
   * @name Get auth import schema
   * @description Retrieves the JSON Schema for importing authentication credentials.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getSchema(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-imports/schema`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput
    );
  }
}
