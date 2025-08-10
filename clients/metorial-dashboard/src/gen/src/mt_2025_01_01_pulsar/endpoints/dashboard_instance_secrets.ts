import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSecretsGetOutput,
  mapDashboardInstanceSecretsListOutput,
  mapDashboardInstanceSecretsListQuery,
  type DashboardInstanceSecretsGetOutput,
  type DashboardInstanceSecretsListOutput,
  type DashboardInstanceSecretsListQuery
} from '../resources';

/**
 * @name Secrets controller
 * @description Secrets represent sensitive information securely stored by Metorial. Secrets are automatically created by Metorial, for example for server deployment configurations.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSecretsEndpoint {
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
   * @name List secrets
   * @description Returns a paginated list of secrets for the instance, optionally filtered by type or status.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSecretsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecretsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSecretsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecretsListOutput> {
    let path = `dashboard/instances/${instanceId}/secrets`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSecretsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSecretsListOutput);
  }

  /**
   * @name Get secret by ID
   * @description Retrieves detailed information about a specific secret by ID.
   *
   * @param `instanceId` - string
   * @param `secretId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecretsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    secretId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecretsGetOutput> {
    let path = `dashboard/instances/${instanceId}/secrets/${secretId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSecretsGetOutput);
  }
}
