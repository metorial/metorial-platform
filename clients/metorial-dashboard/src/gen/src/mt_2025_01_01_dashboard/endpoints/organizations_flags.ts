import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapOrganizationsFlagsGetOutput,
  mapOrganizationsFlagsGetQuery,
  type OrganizationsFlagsGetOutput,
  type OrganizationsFlagsGetQuery
} from '../resources';

/**
 * @name Flags controller
 * @description Read feature flags for the current organization and user
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialOrganizationsFlagsEndpoint {
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
   * @name Get flags
   * @description Get feature flags for the current organization and user
   *
   * @param `organizationId` - string
   * @param `query` - OrganizationsFlagsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns OrganizationsFlagsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    query?: OrganizationsFlagsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<OrganizationsFlagsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/flags`;

    let request = {
      path,

      query: query
        ? mapOrganizationsFlagsGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapOrganizationsFlagsGetOutput);
  }
}
