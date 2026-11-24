import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayTokensCreateBody,
  mapDashboardInstanceAiGatewayTokensCreateOutput,
  mapDashboardInstanceAiGatewayTokensGetOutput,
  mapDashboardInstanceAiGatewayTokensListOutput,
  mapDashboardInstanceAiGatewayTokensListQuery,
  mapDashboardInstanceAiGatewayTokensRevokeOutput,
  mapDashboardInstanceAiGatewayTokensUpdateBody,
  mapDashboardInstanceAiGatewayTokensUpdateOutput,
  type DashboardInstanceAiGatewayTokensCreateBody,
  type DashboardInstanceAiGatewayTokensCreateOutput,
  type DashboardInstanceAiGatewayTokensGetOutput,
  type DashboardInstanceAiGatewayTokensListOutput,
  type DashboardInstanceAiGatewayTokensListQuery,
  type DashboardInstanceAiGatewayTokensRevokeOutput,
  type DashboardInstanceAiGatewayTokensUpdateBody,
  type DashboardInstanceAiGatewayTokensUpdateOutput
} from '../resources';

/**
 * @name AI gateway tokens controller
 * @description API keys for the AI gateway. Each token can be limited to certain models and given its own rate and spend limits.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialAiGatewayTokensEndpoint {
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
   * @name List AI gateway tokens
   * @description Returns a paginated list of tokens, including revoked ones.
   *
   * @param `query` - DashboardInstanceAiGatewayTokensListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayTokensListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceAiGatewayTokensListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayTokensListOutput> {
    let path = 'ai-gateway/tokens';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayTokensListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayTokensListOutput
    );
  }

  /**
   * @name Get AI gateway token
   * @description Retrieves a token by ID. The secret is never returned again.
   *
   * @param `tokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayTokensGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    tokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayTokensGetOutput> {
    let path = `ai-gateway/tokens/${encodeURIComponent(tokenId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayTokensGetOutput
    );
  }

  /**
   * @name Create AI gateway token
   * @description Creates a token. The response contains the secret, which is shown only this once.
   *
   * @param `body` - DashboardInstanceAiGatewayTokensCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayTokensCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceAiGatewayTokensCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayTokensCreateOutput> {
    let path = 'ai-gateway/tokens';

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayTokensCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayTokensCreateOutput
    );
  }

  /**
   * @name Update AI gateway token
   * @description Updates the name, allowed models, limits, metadata or expiry of a token.
   *
   * @param `tokenId` - string
   * @param `body` - DashboardInstanceAiGatewayTokensUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayTokensUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    tokenId: string,
    body: DashboardInstanceAiGatewayTokensUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayTokensUpdateOutput> {
    let path = `ai-gateway/tokens/${encodeURIComponent(tokenId)}`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayTokensUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAiGatewayTokensUpdateOutput
    );
  }

  /**
   * @name Revoke AI gateway token
   * @description Revokes a token. Requests made with it are rejected from then on.
   *
   * @param `tokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayTokensRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    tokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayTokensRevokeOutput> {
    let path = `ai-gateway/tokens/${encodeURIComponent(tokenId)}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayTokensRevokeOutput
    );
  }
}
