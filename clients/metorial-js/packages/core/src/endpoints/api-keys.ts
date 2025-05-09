import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapApiKeysCreateBody,
  mapApiKeysCreateOutput,
  mapApiKeysGetOutput,
  mapApiKeysListOutput,
  mapApiKeysListQuery,
  mapApiKeysRevealOutput,
  mapApiKeysRevokeOutput,
  mapApiKeysRotateBody,
  mapApiKeysRotateOutput,
  mapApiKeysUpdateBody,
  mapApiKeysUpdateOutput,
  type ApiKeysCreateBody,
  type ApiKeysCreateOutput,
  type ApiKeysGetOutput,
  type ApiKeysListOutput,
  type ApiKeysListQuery,
  type ApiKeysRevealOutput,
  type ApiKeysRevokeOutput,
  type ApiKeysRotateBody,
  type ApiKeysRotateOutput,
  type ApiKeysUpdateBody,
  type ApiKeysUpdateOutput
} from '../resources';

/**
 * @name API Key controller
 * @description Read and write API key information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialApiKeysEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get user
   * @description Get the current user information
   *
   * @param `query` - ApiKeysListQuery
   *
   * @returns ApiKeysListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: ApiKeysListQuery) {
    return this._get({
      path: ['api-keys'],

      query: query ? mapApiKeysListQuery.transformTo(query) : undefined
    }).transform(mapApiKeysListOutput);
  }

  /**
   * @name Get API key
   * @description Get the information of a specific API key
   *
   * @param `apiKeyId` - string
   *
   * @returns ApiKeysGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(apiKeyId: string) {
    return this._get({
      path: ['api-keys', apiKeyId]
    }).transform(mapApiKeysGetOutput);
  }

  /**
   * @name Create API key
   * @description Create a new API key
   *
   * @param `body` - ApiKeysCreateBody
   *
   * @returns ApiKeysCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: ApiKeysCreateBody) {
    return this._post({
      path: ['api-keys'],
      body: mapApiKeysCreateBody.transformTo(body)
    }).transform(mapApiKeysCreateOutput);
  }

  /**
   * @name Update API key
   * @description Update the information of a specific API key
   *
   * @param `apiKeyId` - string
   * @param `body` - ApiKeysUpdateBody
   *
   * @returns ApiKeysUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(apiKeyId: string, body: ApiKeysUpdateBody) {
    return this._post({
      path: ['api-keys', apiKeyId],
      body: mapApiKeysUpdateBody.transformTo(body)
    }).transform(mapApiKeysUpdateOutput);
  }

  /**
   * @name Revoke API key
   * @description Revoke a specific API key
   *
   * @param `apiKeyId` - string
   *
   * @returns ApiKeysRevokeOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(apiKeyId: string) {
    return this._delete({
      path: ['api-keys', apiKeyId]
    }).transform(mapApiKeysRevokeOutput);
  }

  /**
   * @name Rotate API key
   * @description Rotate a specific API key
   *
   * @param `apiKeyId` - string
   * @param `body` - ApiKeysRotateBody
   *
   * @returns ApiKeysRotateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotate(apiKeyId: string, body: ApiKeysRotateBody) {
    return this._post({
      path: ['api-keys', apiKeyId, 'rotate'],
      body: mapApiKeysRotateBody.transformTo(body)
    }).transform(mapApiKeysRotateOutput);
  }

  /**
   * @name Reveal API key
   * @description Reveal a specific API key
   *
   * @param `apiKeyId` - string
   *
   * @returns ApiKeysRevealOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reveal(apiKeyId: string) {
    return this._post({
      path: ['api-keys', apiKeyId, 'reveal']
    }).transform(mapApiKeysRevealOutput);
  }
}
