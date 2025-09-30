import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapProviderOauthConnectionTemplateEvaluateBody,
  mapProviderOauthConnectionTemplateEvaluateOutput,
  mapProviderOauthConnectionTemplateGetOutput,
  mapProviderOauthConnectionTemplateListOutput,
  mapProviderOauthConnectionTemplateListQuery,
  type ProviderOauthConnectionTemplateEvaluateBody,
  type ProviderOauthConnectionTemplateEvaluateOutput,
  type ProviderOauthConnectionTemplateGetOutput,
  type ProviderOauthConnectionTemplateListOutput,
  type ProviderOauthConnectionTemplateListQuery
} from '../resources';

/**
 * @name OAuth Connection Template controller
 * @description Get OAuth connection template information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthConnectionTemplateEndpoint {
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
   * @param `query` - ProviderOauthConnectionTemplateListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ProviderOauthConnectionTemplateListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: ProviderOauthConnectionTemplateListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ProviderOauthConnectionTemplateListOutput> {
    let path = `dashboard/organizations/${organizationId}/provider-oauth-connection-template`;

    let request = {
      path,

      query: query
        ? mapProviderOauthConnectionTemplateListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapProviderOauthConnectionTemplateListOutput
    );
  }

  /**
   * @name Get oauth connection template
   * @description Get the information of a specific oauth connection template
   *
   * @param `organizationId` - string
   * @param `oauthTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ProviderOauthConnectionTemplateGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    oauthTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ProviderOauthConnectionTemplateGetOutput> {
    let path = `dashboard/organizations/${organizationId}/provider-oauth-connection-template/${oauthTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapProviderOauthConnectionTemplateGetOutput
    );
  }

  /**
   * @name Evaluate oauth connection template
   * @description Evaluate the configuration of an oauth connection template
   *
   * @param `oauthTemplateId` - string
   * @param `body` - ProviderOauthConnectionTemplateEvaluateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ProviderOauthConnectionTemplateEvaluateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  evaluate(
    oauthTemplateId: string,
    body: ProviderOauthConnectionTemplateEvaluateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ProviderOauthConnectionTemplateEvaluateOutput> {
    let path = `provider-oauth-connection-template/${oauthTemplateId}/evaluate`;

    let request = {
      path,
      body: mapProviderOauthConnectionTemplateEvaluateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapProviderOauthConnectionTemplateEvaluateOutput
    );
  }
}
