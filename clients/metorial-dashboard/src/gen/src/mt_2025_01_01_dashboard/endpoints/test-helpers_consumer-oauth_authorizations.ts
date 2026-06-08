import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapTestHelpersConsumerOauthAuthorizationsCreateBody,
  mapTestHelpersConsumerOauthAuthorizationsCreateOutput,
  type TestHelpersConsumerOauthAuthorizationsCreateBody,
  type TestHelpersConsumerOauthAuthorizationsCreateOutput
} from '../resources';

/**
 * @name Test Helper Consumer OAuth controller
 * @description Helpers for testing consumer OAuth flows.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialTestHelpersConsumerOauthAuthorizationsEndpoint {
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
   * @name Create consumer OAuth test authorization
   * @description Creates a single-use test authorization token for a consumer OAuth authorize URL.
   *
   * @param `body` - TestHelpersConsumerOauthAuthorizationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns TestHelpersConsumerOauthAuthorizationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: TestHelpersConsumerOauthAuthorizationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<TestHelpersConsumerOauthAuthorizationsCreateOutput> {
    let path = 'test-helpers/consumer-oauth-authorizations';

    let request = {
      path,
      body: mapTestHelpersConsumerOauthAuthorizationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapTestHelpersConsumerOauthAuthorizationsCreateOutput
    );
  }
}
