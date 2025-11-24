import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapCustomServersManagedServerTemplatesGetOutput,
  mapCustomServersManagedServerTemplatesListOutput,
  mapCustomServersManagedServerTemplatesListQuery,
  type CustomServersManagedServerTemplatesGetOutput,
  type CustomServersManagedServerTemplatesListOutput,
  type CustomServersManagedServerTemplatesListQuery
} from '../resources';

/**
 * @name Managed Server Template controller
 * @description Get managed server template information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersManagedServerTemplatesEndpoint {
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
   * @name List oauth connection templates
   * @description List all oauth connection templates
   *
   * @param `organizationId` - string
   * @param `query` - CustomServersManagedServerTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns CustomServersManagedServerTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: CustomServersManagedServerTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<CustomServersManagedServerTemplatesListOutput> {
    let path = `dashboard/organizations/${organizationId}/managed-server-templates`;

    let request = {
      path,

      query: query
        ? mapCustomServersManagedServerTemplatesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapCustomServersManagedServerTemplatesListOutput
    );
  }

  /**
   * @name Get oauth connection template
   * @description Get the information of a specific oauth connection template
   *
   * @param `organizationId` - string
   * @param `managedServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns CustomServersManagedServerTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    managedServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<CustomServersManagedServerTemplatesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/managed-server-templates/${managedServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapCustomServersManagedServerTemplatesGetOutput
    );
  }
}
