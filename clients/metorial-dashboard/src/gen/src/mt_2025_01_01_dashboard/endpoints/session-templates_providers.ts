import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

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
 * @description A session template provider is one provider in a session template, with its deployment, config, auth config, and tool filters.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionTemplatesProvidersEndpoint {
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
   * @description Returns a paginated list of session template providers.
   *
   * @param `query` - DashboardInstanceSessionTemplatesProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSessionTemplatesProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersListOutput> {
    let path = 'session-template-providers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionTemplatesProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersListOutput
    );
  }

  /**
   * @name Get session template provider
   * @description Retrieves a session template provider.
   *
   * @param `sessionTemplateProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionTemplateProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersGetOutput> {
    let path = `session-template-providers/${encodeURIComponent(sessionTemplateProviderId)}`;

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
   * @description Creates a session template provider.
   *
   * @param `body` - DashboardInstanceSessionTemplatesProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSessionTemplatesProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersCreateOutput> {
    let path = 'session-template-providers';

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesProvidersCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersCreateOutput
    );
  }

  /**
   * @name Update session template provider
   * @description Updates a session template provider.
   *
   * @param `sessionTemplateProviderId` - string
   * @param `body` - DashboardInstanceSessionTemplatesProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    sessionTemplateProviderId: string,
    body: DashboardInstanceSessionTemplatesProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersUpdateOutput> {
    let path = `session-template-providers/${encodeURIComponent(sessionTemplateProviderId)}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesProvidersUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersUpdateOutput
    );
  }

  /**
   * @name Archive session template provider
   * @description Archives a session template provider. It stays listable with `status=archived`.
   *
   * @param `sessionTemplateProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    sessionTemplateProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesProvidersDeleteOutput> {
    let path = `session-template-providers/${encodeURIComponent(sessionTemplateProviderId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSessionTemplatesProvidersDeleteOutput
    );
  }
}
