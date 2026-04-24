import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerConsumerInternalOauthAuthorizationsAcceptOutput,
  mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody,
  mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput,
  mapConsumerConsumerInternalOauthAuthorizationsGetOutput,
  mapConsumerConsumerInternalOauthAuthorizationsRejectOutput,
  type ConsumerConsumerInternalOauthAuthorizationsAcceptOutput,
  type ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody,
  type ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput,
  type ConsumerConsumerInternalOauthAuthorizationsGetOutput,
  type ConsumerConsumerInternalOauthAuthorizationsRejectOutput
} from '../resources';

/**
 * @name Consumer Providers controller
 * @description Browse and configure portal providers from the consumer side.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerConsumerInternalOauthAuthorizationsEndpoint {
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
   * @name Get portal OAuth authorization
   * @description Returns the current portal OAuth authorization request for the active consumer.
   *
   * @param `portalAuthAttemptId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerConsumerInternalOauthAuthorizationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalAuthAttemptId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerConsumerInternalOauthAuthorizationsGetOutput> {
    let path = `consumer/portal-oauth-attempts/${portalAuthAttemptId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerConsumerInternalOauthAuthorizationsGetOutput
    );
  }

  /**
   * @name Accept portal OAuth authorization
   * @description Approves a pending portal OAuth authorization request and returns the redirect URL.
   *
   * @param `portalAuthAttemptId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerConsumerInternalOauthAuthorizationsAcceptOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  accept(
    portalAuthAttemptId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerConsumerInternalOauthAuthorizationsAcceptOutput> {
    let path = `consumer/portal-oauth-attempts/${portalAuthAttemptId}/accept`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerConsumerInternalOauthAuthorizationsAcceptOutput
    );
  }

  /**
   * @name Connect portal OAuth authorization to magic MCP endpoint
   * @description Links a pending portal OAuth authorization request to a consumer-owned magic MCP endpoint.
   *
   * @param `portalAuthAttemptId` - string
   * @param `body` - ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  connectMagicMcpEndpoint(
    portalAuthAttemptId: string,
    body: ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput> {
    let path = `consumer/portal-oauth-attempts/${portalAuthAttemptId}/connect-magic-mcp-endpoint`;

    let request = {
      path,
      body: mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerConsumerInternalOauthAuthorizationsConnectMagicMcpEndpointOutput
    );
  }

  /**
   * @name Reject portal OAuth authorization
   * @description Rejects a pending portal OAuth authorization request and returns the redirect URL.
   *
   * @param `portalAuthAttemptId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerConsumerInternalOauthAuthorizationsRejectOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reject(
    portalAuthAttemptId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerConsumerInternalOauthAuthorizationsRejectOutput> {
    let path = `consumer/portal-oauth-attempts/${portalAuthAttemptId}/reject`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerConsumerInternalOauthAuthorizationsRejectOutput
    );
  }
}
