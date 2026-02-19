import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
  mapDashboardInstanceProviderDeploymentsConfigVaultsCreateOutput,
  mapDashboardInstanceProviderDeploymentsConfigVaultsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsConfigVaultsGetOutput,
  mapDashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  mapDashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  mapDashboardInstanceProviderDeploymentsConfigVaultsUpdateBody,
  mapDashboardInstanceProviderDeploymentsConfigVaultsUpdateOutput,
  type DashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
  type DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput,
  type DashboardInstanceProviderDeploymentsConfigVaultsDeleteOutput,
  type DashboardInstanceProviderDeploymentsConfigVaultsGetOutput,
  type DashboardInstanceProviderDeploymentsConfigVaultsListOutput,
  type DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
  type DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody,
  type DashboardInstanceProviderDeploymentsConfigVaultsUpdateOutput
} from '../resources';

/**
 * @name Provider Config Vaults controller
 * @description A config vault is a saved, reusable set of configuration values. Use vaults to store credentials once and apply them to multiple deployments without re-entering.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint {
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
   * @name List provider config vaults
   * @description Returns a paginated list of provider config vaults.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsConfigVaultsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigVaultsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerDeploymentId: string,
    query?: DashboardInstanceProviderDeploymentsConfigVaultsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigVaultsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/config-vaults`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsConfigVaultsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigVaultsListOutput
    );
  }

  /**
   * @name Get provider config vault
   * @description Retrieves a specific provider config vault by ID.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerConfigVaultId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigVaultsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerDeploymentId: string,
    providerConfigVaultId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigVaultsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/config-vaults/${providerConfigVaultId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigVaultsGetOutput
    );
  }

  /**
   * @name Create provider config vault
   * @description Creates a new provider config vault.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsConfigVaultsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    providerDeploymentId: string,
    body: DashboardInstanceProviderDeploymentsConfigVaultsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/config-vaults`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsConfigVaultsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigVaultsCreateOutput
    );
  }

  /**
   * @name Update provider config vault
   * @description Updates a specific provider config vault.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerConfigVaultId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigVaultsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerDeploymentId: string,
    providerConfigVaultId: string,
    body: DashboardInstanceProviderDeploymentsConfigVaultsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigVaultsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/config-vaults/${providerConfigVaultId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsConfigVaultsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigVaultsUpdateOutput
    );
  }

  /**
   * @name Delete provider config vault
   * @description Permanently deletes a provider config vault.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerConfigVaultId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigVaultsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerDeploymentId: string,
    providerConfigVaultId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigVaultsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/config-vaults/${providerConfigVaultId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigVaultsDeleteOutput
    );
  }
}
