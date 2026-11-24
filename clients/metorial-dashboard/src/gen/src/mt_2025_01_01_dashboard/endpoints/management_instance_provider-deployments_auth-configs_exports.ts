import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody,
  mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsExportsGetOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsExportsListOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsExportsListQuery,
  type DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody,
  type DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsExportsGetOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsExportsListOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsExportsListQuery
} from '../resources';

/**
 * @name Provider Auth Exports controller
 * @description A provider auth export is a copy of authentication credentials taken out of Metorial for use in another system.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderDeploymentsAuthConfigsExportsEndpoint {
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
   * @name List provider auth exports
   * @description Returns a paginated list of provider auth exports.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsAuthConfigsExportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsExportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsAuthConfigsExportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsExportsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/provider-auth-config-exports`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsAuthConfigsExportsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsExportsListOutput
    );
  }

  /**
   * @name Get provider auth export
   * @description Retrieves a specific provider auth export by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthExportId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsExportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthExportId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsExportsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/provider-auth-config-exports/${encodeURIComponent(providerAuthExportId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsExportsGetOutput
    );
  }

  /**
   * @name Create provider auth export
   * @description Exports the credentials of a provider auth config for use outside Metorial.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/provider-auth-config-exports`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsExportsCreateOutput
    );
  }
}
