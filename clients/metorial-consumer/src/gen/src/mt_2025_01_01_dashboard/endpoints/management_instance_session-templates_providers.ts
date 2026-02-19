import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionTemplatesProvidersCreateBody,
  mapDashboardInstanceSessionTemplatesProvidersCreateOutput,
  mapDashboardInstanceSessionTemplatesProvidersDeleteOutput,
  mapDashboardInstanceSessionTemplatesProvidersGetOutput,
  mapDashboardInstanceSessionTemplatesProvidersListOutput,
  mapDashboardInstanceSessionTemplatesProvidersListQuery,
  mapDashboardInstanceSessionTemplatesProvidersUpdateBody,
  mapDashboardInstanceSessionTemplatesProvidersUpdateOutput,
  type DashboardInstanceSessionTemplatesProvidersCreateBody,
  type DashboardInstanceSessionTemplatesProvidersCreateOutput,
  type DashboardInstanceSessionTemplatesProvidersDeleteOutput,
  type DashboardInstanceSessionTemplatesProvidersGetOutput,
  type DashboardInstanceSessionTemplatesProvidersListOutput,
  type DashboardInstanceSessionTemplatesProvidersListQuery,
  type DashboardInstanceSessionTemplatesProvidersUpdateBody,
  type DashboardInstanceSessionTemplatesProvidersUpdateOutput
} from '../resources';

/**
 * @name Session Template Providers controller
 * @description Session template providers define which providers should be included when a session is created from a template.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionTemplatesProvidersEndpoint {
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
   * @name List session template providers
   * @description Returns a paginated list of providers configured for a session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `query` - DashboardInstanceSessionTemplatesProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionTemplateId: string,
    query?: DashboardInstanceSessionTemplatesProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersListOutput> {
    let path = `instances/${instanceId}/session-templates/${sessionTemplateId}/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionTemplatesProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersListOutput
    );
  }

  /**
   * @name Get session template provider
   * @description Retrieves a specific provider configuration from a session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `sessionTemplateProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionTemplateId: string,
    sessionTemplateProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersGetOutput> {
    let path = `instances/${instanceId}/session-templates/${sessionTemplateId}/providers/${sessionTemplateProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersGetOutput
    );
  }

  /**
   * @name Create session template provider
   * @description Adds a new provider configuration to a session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `body` - DashboardInstanceSessionTemplatesProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    sessionTemplateId: string,
    body: DashboardInstanceSessionTemplatesProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersCreateOutput> {
    let path = `instances/${instanceId}/session-templates/${sessionTemplateId}/providers`;

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesProvidersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersCreateOutput
    );
  }

  /**
   * @name Update session template provider
   * @description Updates a provider configuration in a session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `sessionTemplateProviderId` - string
   * @param `body` - DashboardInstanceSessionTemplatesProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    sessionTemplateId: string,
    sessionTemplateProviderId: string,
    body: DashboardInstanceSessionTemplatesProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersUpdateOutput> {
    let path = `instances/${instanceId}/session-templates/${sessionTemplateId}/providers/${sessionTemplateProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersUpdateOutput
    );
  }

  /**
   * @name Delete session template provider
   * @description Removes a provider configuration from a session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `sessionTemplateProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    sessionTemplateId: string,
    sessionTemplateProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersDeleteOutput> {
    let path = `instances/${instanceId}/session-templates/${sessionTemplateId}/providers/${sessionTemplateProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersDeleteOutput
    );
  }
}
