import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderTemplatesCreateBody,
  mapDashboardInstanceProviderTemplatesCreateOutput,
  mapDashboardInstanceProviderTemplatesDeleteOutput,
  mapDashboardInstanceProviderTemplatesGetOutput,
  mapDashboardInstanceProviderTemplatesListOutput,
  mapDashboardInstanceProviderTemplatesListQuery,
  mapDashboardInstanceProviderTemplatesUpdateBody,
  mapDashboardInstanceProviderTemplatesUpdateOutput,
  type DashboardInstanceProviderTemplatesCreateBody,
  type DashboardInstanceProviderTemplatesCreateOutput,
  type DashboardInstanceProviderTemplatesDeleteOutput,
  type DashboardInstanceProviderTemplatesGetOutput,
  type DashboardInstanceProviderTemplatesListOutput,
  type DashboardInstanceProviderTemplatesListQuery,
  type DashboardInstanceProviderTemplatesUpdateBody,
  type DashboardInstanceProviderTemplatesUpdateOutput
} from '../resources';

/**
 * @name Provider Templates controller
 * @description Provider templates are reusable, consumer-facing wrappers around provider deployments.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderTemplatesEndpoint {
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
   * @name List provider templates
   * @description Returns a paginated list of provider templates.
   *
   * @param `query` - DashboardInstanceProviderTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderTemplatesListOutput> {
    let path = 'provider-templates';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderTemplatesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderTemplatesListOutput
    );
  }

  /**
   * @name Get provider template
   * @description Retrieves a specific provider template.
   *
   * @param `providerTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderTemplatesGetOutput> {
    let path = `provider-templates/${providerTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderTemplatesGetOutput
    );
  }

  /**
   * @name Create provider template
   * @description Creates a new provider template from an existing provider deployment or creates a minimal backing deployment first.
   *
   * @param `body` - DashboardInstanceProviderTemplatesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderTemplatesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderTemplatesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderTemplatesCreateOutput> {
    let path = 'provider-templates';

    let request = {
      path,
      body: mapDashboardInstanceProviderTemplatesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderTemplatesCreateOutput
    );
  }

  /**
   * @name Update provider template
   * @description Updates an existing provider template.
   *
   * @param `providerTemplateId` - string
   * @param `body` - DashboardInstanceProviderTemplatesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderTemplatesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    providerTemplateId: string,
    body: DashboardInstanceProviderTemplatesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderTemplatesUpdateOutput> {
    let path = `provider-templates/${providerTemplateId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderTemplatesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderTemplatesUpdateOutput
    );
  }

  /**
   * @name Archive provider template
   * @description Archives an existing provider template.
   *
   * @param `providerTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderTemplatesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    providerTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderTemplatesDeleteOutput> {
    let path = `provider-templates/${providerTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderTemplatesDeleteOutput
    );
  }
}
