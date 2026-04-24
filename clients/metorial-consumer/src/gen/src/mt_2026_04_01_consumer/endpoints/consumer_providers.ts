import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerProvidersDeployBody,
  mapConsumerProvidersDeployOutput,
  mapConsumerProvidersGetOutput,
  mapConsumerProvidersGetSetupOutput,
  mapConsumerProvidersListOutput,
  mapConsumerProvidersListQuery,
  mapConsumerProvidersRequestAccessBody,
  mapConsumerProvidersRequestAccessOutput,
  mapConsumerProvidersSetupBody,
  mapConsumerProvidersSetupOutput,
  type ConsumerProvidersDeployBody,
  type ConsumerProvidersDeployOutput,
  type ConsumerProvidersGetOutput,
  type ConsumerProvidersGetSetupOutput,
  type ConsumerProvidersListOutput,
  type ConsumerProvidersListQuery,
  type ConsumerProvidersRequestAccessBody,
  type ConsumerProvidersRequestAccessOutput,
  type ConsumerProvidersSetupBody,
  type ConsumerProvidersSetupOutput
} from '../resources';

/**
 * @name Consumer Providers controller
 * @description Browse and configure portal providers from the consumer side.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerProvidersEndpoint {
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
   * @name List consumer providers
   * @description Returns the unified portal catalog with consumer availability.
   *
   * @param `query` - ConsumerProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersListOutput> {
    let path = 'consumer/providers';

    let request = {
      path,

      query: query
        ? mapConsumerProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerProvidersListOutput);
  }

  /**
   * @name Get consumer provider
   * @description Returns one portal catalog item with any available setup capability data.
   *
   * @param `catalogItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    catalogItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersGetOutput> {
    let path = `consumer/providers/${catalogItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerProvidersGetOutput);
  }

  /**
   * @name Request consumer provider access
   * @description Creates an access request for a portal catalog item.
   *
   * @param `catalogItemId` - string
   * @param `body` - ConsumerProvidersRequestAccessBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersRequestAccessOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  requestAccess(
    catalogItemId: string,
    body: ConsumerProvidersRequestAccessBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersRequestAccessOutput> {
    let path = `consumer/providers/${catalogItemId}/request-access`;

    let request = {
      path,
      body: mapConsumerProvidersRequestAccessBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerProvidersRequestAccessOutput
    );
  }

  /**
   * @name Start consumer provider setup
   * @description Starts an OAuth setup flow for a portal provider template.
   *
   * @param `catalogItemId` - string
   * @param `body` - ConsumerProvidersSetupBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersSetupOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  setup(
    catalogItemId: string,
    body: ConsumerProvidersSetupBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersSetupOutput> {
    let path = `consumer/providers/${catalogItemId}/setup`;

    let request = {
      path,
      body: mapConsumerProvidersSetupBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerProvidersSetupOutput);
  }

  /**
   * @name Get consumer provider setup
   * @description Reads the status of an OAuth setup flow for a portal provider template.
   *
   * @param `catalogItemId` - string
   * @param `providerSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersGetSetupOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getSetup(
    catalogItemId: string,
    providerSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersGetSetupOutput> {
    let path = `consumer/providers/${catalogItemId}/setup/${providerSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerProvidersGetSetupOutput);
  }

  /**
   * @name Deploy consumer provider
   * @description Creates an owned Magic MCP server from a portal provider template.
   *
   * @param `catalogItemId` - string
   * @param `body` - ConsumerProvidersDeployBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersDeployOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  deploy(
    catalogItemId: string,
    body: ConsumerProvidersDeployBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersDeployOutput> {
    let path = `consumer/providers/${catalogItemId}/deploy`;

    let request = {
      path,
      body: mapConsumerProvidersDeployBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerProvidersDeployOutput);
  }
}
