import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerOauthAuthorizationsGetOutput,
  mapConsumerOauthAuthorizationsListOutput,
  mapConsumerOauthAuthorizationsListQuery,
  mapConsumerOauthAuthorizationsRevokeOutput,
  type ConsumerOauthAuthorizationsGetOutput,
  type ConsumerOauthAuthorizationsListOutput,
  type ConsumerOauthAuthorizationsListQuery,
  type ConsumerOauthAuthorizationsRevokeOutput
} from '../resources';

/**
 * @name Consumer OAuth Authorization controller
 * @description Inspect and revoke the applications the consumer has authorized.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerOauthAuthorizationsEndpoint {
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
   * @name List consumer OAuth authorizations
   * @description Returns the applications the authenticated consumer has authorized.
   *
   * @param `query` - ConsumerOauthAuthorizationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerOauthAuthorizationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerOauthAuthorizationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerOauthAuthorizationsListOutput> {
    let path = 'consumer/oauth/authorizations';

    let request = {
      path,

      query: query
        ? mapConsumerOauthAuthorizationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerOauthAuthorizationsListOutput
    );
  }

  /**
   * @name Get consumer OAuth authorization
   * @description Returns an application authorization of the authenticated consumer.
   *
   * @param `oauthAuthorizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerOauthAuthorizationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    oauthAuthorizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerOauthAuthorizationsGetOutput> {
    let path = `consumer/oauth/authorizations/${oauthAuthorizationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerOauthAuthorizationsGetOutput
    );
  }

  /**
   * @name Revoke consumer OAuth authorization
   * @description Revokes an application authorization of the authenticated consumer, signing the application out.
   *
   * @param `oauthAuthorizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerOauthAuthorizationsRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    oauthAuthorizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerOauthAuthorizationsRevokeOutput> {
    let path = `consumer/oauth/authorizations/${oauthAuthorizationId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerOauthAuthorizationsRevokeOutput
    );
  }
}
