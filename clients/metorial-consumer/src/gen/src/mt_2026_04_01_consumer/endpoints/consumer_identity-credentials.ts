import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerIdentityCredentialsGetOutput,
  mapConsumerIdentityCredentialsListOutput,
  mapConsumerIdentityCredentialsListQuery,
  type ConsumerIdentityCredentialsGetOutput,
  type ConsumerIdentityCredentialsListOutput,
  type ConsumerIdentityCredentialsListQuery
} from '../resources';

/**
 * @name Consumer Activity controller
 * @description Inspect runtime clients, connections, operations, and credentials for the authenticated consumer profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerIdentityCredentialsEndpoint {
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
   * @name List consumer identity credentials
   * @description Returns read-only credentials for identities owned by the authenticated profile actor.
   *
   * @param `query` - ConsumerIdentityCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerIdentityCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerIdentityCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerIdentityCredentialsListOutput> {
    let path = 'consumer/identity-credentials';

    let request = {
      path,

      query: query
        ? mapConsumerIdentityCredentialsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerIdentityCredentialsListOutput
    );
  }

  /**
   * @name Get consumer identity credential
   * @description Retrieves one credential belonging to an identity owned by the authenticated profile actor.
   *
   * @param `identityCredentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerIdentityCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    identityCredentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerIdentityCredentialsGetOutput> {
    let path = `consumer/identity-credentials/${identityCredentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerIdentityCredentialsGetOutput
    );
  }
}
