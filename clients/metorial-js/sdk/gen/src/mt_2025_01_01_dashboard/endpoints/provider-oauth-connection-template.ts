import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapProviderOauthConnectionTemplateGetOutput,
  mapProviderOauthConnectionTemplateListOutput,
  mapProviderOauthConnectionTemplateListQuery,
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
export class MetorialProviderOauthConnectionTemplateEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List oauth connection templates
   * @description List all oauth connection templates
   *
   * @param `query` - ProviderOauthConnectionTemplateListQuery
   *
   * @returns ProviderOauthConnectionTemplateListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: ProviderOauthConnectionTemplateListQuery) {
    return this._get({
      path: ['provider-oauth-connection-template'],

      query: query
        ? mapProviderOauthConnectionTemplateListQuery.transformTo(query)
        : undefined
    }).transform(mapProviderOauthConnectionTemplateListOutput);
  }

  /**
   * @name Get oauth connection template
   * @description Get the information of a specific oauth connection template
   *
   * @param `oauthTemplateId` - string
   *
   * @returns ProviderOauthConnectionTemplateGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(oauthTemplateId: string) {
    return this._get({
      path: ['provider-oauth-connection-template', oauthTemplateId]
    }).transform(mapProviderOauthConnectionTemplateGetOutput);
  }
}
