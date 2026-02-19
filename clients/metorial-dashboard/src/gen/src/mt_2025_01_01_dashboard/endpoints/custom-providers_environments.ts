import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersEnvironmentsGetOutput,
  mapDashboardInstanceCustomProvidersEnvironmentsListOutput,
  mapDashboardInstanceCustomProvidersEnvironmentsListQuery,
  type DashboardInstanceCustomProvidersEnvironmentsGetOutput,
  type DashboardInstanceCustomProvidersEnvironmentsListOutput,
  type DashboardInstanceCustomProvidersEnvironmentsListQuery
} from '../resources';

/**
 * @name Custom Provider Environments controller
 * @description Environments represent deployment targets for custom provider versions (e.g., staging, production).
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomProvidersEnvironmentsEndpoint {
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
   * @name List custom provider environments
   * @description Returns a paginated list of environments for a custom provider.
   *
   * @param `customProviderId` - string
   * @param `query` - DashboardInstanceCustomProvidersEnvironmentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersEnvironmentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    customProviderId: string,
    query?: DashboardInstanceCustomProvidersEnvironmentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersEnvironmentsListOutput> {
    let path = `custom-providers/${customProviderId}/environments`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomProvidersEnvironmentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersEnvironmentsListOutput
    );
  }

  /**
   * @name Get custom provider environment
   * @description Retrieves a specific environment.
   *
   * @param `customProviderId` - string
   * @param `customProviderEnvironmentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersEnvironmentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    customProviderId: string,
    customProviderEnvironmentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersEnvironmentsGetOutput> {
    let path = `custom-providers/${customProviderId}/environments/${customProviderEnvironmentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersEnvironmentsGetOutput
    );
  }
}
